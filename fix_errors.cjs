const fs = require('fs');

// server.ts
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/const existingFarmers = existingSnapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);/, "const existingFarmers = existingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));");
fs.writeFileSync('server.ts', code);

// Farmers.tsx
code = fs.readFileSync('src/pages/Farmers.tsx', 'utf8');
code = code.replace(/f => f\.email/g, "f => (f as any).email");
code = code.replace(/action: 'COMMUNICATE',/g, "action: 'UPDATE',");
fs.writeFileSync('src/pages/Farmers.tsx', code);
