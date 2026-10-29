import express from "express";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import { GoogleGenAI } from "@google/genai";

import { adminAuth, adminDb } from "./src/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { farmerSchema } from './src/lib/validation';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Gemini Agricultural Farm Advisor & Agronomist Chat with Google Maps Grounding
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { messages, location } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }

      const contents = messages.map((m: { role: string; text: string }) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: String(m.text || "") }]
      }));

      const systemInstruction = `You are the Agricultural Farm Advisor, Senior Agronomist, and Extension Officer for Agri-OS (Agricultural Operating System).
Your duties:
1. Agronomy & Crop Advisory: Expert advice on crops (maize, cassava, rice, sorghum, soybean, yams, vegetables), soil conditioning, fertilizer application protocols (NPK, Urea, compost), pest/disease prevention (Fall Armyworm, Cassava Mosaic, Bacterial Blight), crop rotation, and optimal planting/harvesting dates.
2. Yield Analysis & Record Benchmarking: Helping evaluate yield amounts (kg/ha or metric tons), identifying underperforming fields, and offering actionable post-harvest loss prevention strategies.
3. Storage, Warehouses & Silos: Advise on hermetic bags, grain silo aeration, moisture testing, pest control, and local aggregation hubs.
4. Google Maps Grounding & Local Agricultural Centers: Always use Google Maps grounding whenever the user asks for local silos, agricultural storage facilities, fertilizer/seed dealers, farm equipment centers, research institutes, veterinary stores, or agricultural extension offices. Provide accurate names, addresses, and details from Google Maps.

Formatting: Use clean, professional markdown with headings, bullet points, and highlighted recommendations. Include actionable next steps for farmers and agricultural field officers.`;

      const config: any = {
        systemInstruction,
        tools: [{ googleMaps: {} }]
      };

      if (location && typeof location.latitude === "number" && typeof location.longitude === "number") {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: location.latitude,
              longitude: location.longitude
            }
          }
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config
      });

      const replyText = response.text || "";
      const candidate = response.candidates?.[0];
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const webSearchQueries = candidate?.groundingMetadata?.webSearchQueries || [];

      res.json({
        success: true,
        text: replyText,
        groundingChunks,
        webSearchQueries
      });
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      res.status(500).json({
        error: error.message || "Failed to generate agricultural advice",
        details: error.toString()
      });
    }
  });

  const db = adminDb || getFirestore();

  // Connector Import
  app.post("/api/connectors/import", async (req, res) => {
    try {
      const { type, config, mappings, rows } = req.body;
      
      // Since this is the API gateway layer for our Connector Framework, 
      // we apply the mapping rules then use the Firestore connector as the destination primary DB.
      
      // In a real multi-connector setup, we would instantiate the right connector:
      // const sourceConnector = getConnector(type);
      // await sourceConnector.connect(config);
      // const sourceData = await sourceConnector.read(query);
      
      // For this step, we assume the client parsed the source (e.g. Google Sheets/CSV)
      // and sent the mapped rows ready for the Primary DB (Firestore here).
      
      const { FirestoreConnector } = await import('./src/connectors/FirestoreConnector');
      const primaryDb = new FirestoreConnector();
      await primaryDb.connect({ collection: 'importStaging' });
      
      
      // Perform deduplication/validation here before writing to staging
      const existingSnapshot = await db.collection('farmers').get();
      const existingFarmers = existingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const orgsSnap = await db.collection('organizations').get();
      const orgIds = new Set(orgsSnap.docs.map(d => d.id));
      const progSnap = await db.collection('programs').get();
      const progIds = new Set(progSnap.docs.map(d => d.id));

      
      const stagedRows = rows.map(rec => {
        let status = 'pending';
        let duplicateOf = '';
        let errorReason = '';
        
        
        
        // Schema Validation
        const valResult = farmerSchema.safeParse(rec);
        if (!valResult.success) {
          status = 'error';
          errorReason = valResult.error.issues.map(e => e.message).join(', ');
        }
        
        // FK Validation
        if (rec.organizationId) {
          if (!orgIds.has(rec.organizationId)) {
            status = 'error';
            errorReason = 'Invalid organizationId';
          }
        }
        if (rec.programId) {
          if (!progIds.has(rec.programId)) {
            status = 'error';
            errorReason = 'Invalid programId';
          }
        }

        // Simple fuzzy match
        for (const f of existingFarmers) {
          if (rec.primaryPhone && f.primaryPhone === rec.primaryPhone) {
            duplicateOf = f.id;
            status = 'duplicate_warning';
            break;
          }
          if (rec.firstName && rec.lastName && 
              f.firstName?.toLowerCase() === rec.firstName.toLowerCase() && 
              f.lastName?.toLowerCase() === rec.lastName.toLowerCase()) {
            duplicateOf = f.id;
            status = 'duplicate_warning';
            break;
          }
        }
        
        return {
          data: rec,
          status,
          errorReason,
          duplicateOf
        };
      });
      
      const result = await primaryDb.write(stagedRows);

      await primaryDb.disconnect();
      
      res.json({ success: true, result });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create User
  app.post("/api/users", async (req, res) => {
    try {
      const { email, password, displayName, role, permissions, accessLevel } = req.body;
      
      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email,
          password: password || 'DefaultPassword123!',
          displayName
        });
      } catch (authError: any) {
        console.warn('adminAuth failed, falling back to mock user creation:', authError);
        // Fallback to mock uid for preview environments
        userRecord = { uid: 'mock-' + Math.random().toString(36).substr(2, 9) };
      }

      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        displayName,
        role: role || 'Field Agent',
        permissions: permissions || [],
        accessLevel: accessLevel || 1,
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Users
  app.get("/api/users", async (req, res) => {
    try {
      const snapshot = await db.collection("users").get();
      const users = snapshot.docs.map(doc => doc.data());
      res.json(users);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update User Role
  app.put("/api/users/:uid/role", async (req, res) => {
    try {
      const { uid } = req.params;
      const { role, permissions, accessLevel } = req.body;
      await db.collection("users").doc(uid).update({ role });
      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  
  // Update User Password
  app.put("/api/users/:uid/password", async (req, res) => {
    try {
      const { uid } = req.params;
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }
      try {
        await adminAuth.updateUser(uid, { password });
      } catch (authError: any) {
        console.warn('adminAuth failed to update password:', authError);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete User
  app.delete("/api/users/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      try {
        await adminAuth.deleteUser(uid);
      } catch (authError) {
        console.warn('Could not delete from Firebase Auth (might be a mock user):', authError);
      }
      await db.collection("users").doc(uid).delete();
      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/forms/create", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
      const token = authHeader.split('Bearer ')[1];
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });
      const forms = google.forms({ version: 'v1', auth });

      const { title } = req.body;
      const form = await forms.forms.create({
        requestBody: {
          info: { title: title || 'Farmer Data Collection Form' }
        }
      });
      res.json({ success: true, formId: form.data.formId, url: form.data.responderUri });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gmail/send", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
      const token = authHeader.split('Bearer ')[1];
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });
      const gmail = google.gmail({ version: 'v1', auth });

      const { to, subject, body } = req.body;
      
      const emailLines = [
        `To: ${to}`,
        'Content-type: text/html;charset=iso-8859-1',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        body
      ];
      const email = emailLines.join('\r\n').trim();
      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedEmail }
      });
      
      res.json({ success: true, messageId: response.data.id });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  
  app.post("/api/sheets/create", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
      const token = authHeader.split('Bearer ')[1];
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });
      
      const sheets = google.sheets({ version: 'v4', auth });
      const drive = google.drive({ version: 'v3', auth });
      
      const { title, folderId } = req.body;
      
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: title || 'New Workbook' }
        }
      });
      
      const fileId = spreadsheet.data.spreadsheetId;
      
      // If folderId is provided, move the file to that folder
      if (folderId && fileId) {
        // Retrieve the existing parents to remove
        const file = await drive.files.get({
          fileId: fileId,
          fields: 'parents'
        });
        const previousParents = file.data.parents?.join(',') || '';
        
        await drive.files.update({
          fileId: fileId,
          addParents: folderId,
          removeParents: previousParents,
          fields: 'id, parents'
        });
      }
      
      res.json({ success: true, spreadsheetId: fileId, url: spreadsheet.data.spreadsheetUrl });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/drive/folders", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
      const token = authHeader.split('Bearer ')[1];
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });
      
      const drive = google.drive({ version: 'v3', auth });
      
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      res.json({ success: true, folders: response.data.files });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/docs/export", async (req, res) => {
    try {
      // In a real app, you would pass the access token from the client or auth middleware
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Missing authorization header" });
      }

      const token = authHeader.split('Bearer ')[1];
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });

      const docs = google.docs({ version: 'v1', auth });
      const drive = google.drive({ version: 'v3', auth });

      const { farmers } = req.body;

      // 1. Create a new blank document
      const doc = await docs.documents.create({
        requestBody: {
          title: `Farmers Report - ${new Date().toLocaleDateString()}`,
        }
      });
      const documentId = doc.data.documentId;
      if (!documentId) throw new Error("Failed to create document");

      // 2. Insert text into the document
      let textContent = "Registered Farmers Report\n\n";
      farmers.forEach((f: any, idx: number) => {
        textContent += `${idx + 1}. ${f.title || ''} ${f.firstName} ${f.lastName} (ID: ${f.farmerID})\n`;
        textContent += `   State: ${f.state} | LGA: ${f.lga} | Crop: ${f.crop}\n\n`;
      });

      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: textContent
              }
            }
          ]
        }
      });

      res.json({ success: true, documentId, url: `https://docs.google.com/document/d/${documentId}/edit` });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // use express v4 catch all
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
