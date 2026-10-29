import { create } from 'zustand';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FarmerState, Farmer } from '../types';
import { useActivityLogStore } from './useActivityLogStore';
import { farmerSchema } from '../lib/validation';
import { STATE_COORDS } from '../lib/nigeriaData';

// Helper to calculate a mock credit score based on available data
const calculateCreditScore = (farmer: Partial<Farmer>) => {
  const farmSizeScore = Math.min((farmer.farmSize || 0) * 10, 300);
  const experienceScore = Math.min((farmer.experience || 0) * 20, 200);
  const kycScore = farmer.kycComplete ? 200 : 0;
  
  const total = 300 + farmSizeScore + experienceScore + kycScore; // Base 300
  
  return {
    score: Math.min(Math.round(total), 850),
    factors: {
      farmSize: Math.round(farmSizeScore),
      experience: Math.round(experienceScore),
      kycComplete: kycScore,
      repaymentHistory: 0,
    },
    lastUpdated: new Date().toISOString()
  };
};

export const generateFarmerID = (farmer: Partial<Farmer>) => {
  const org = (farmer.organizationId || 'ORG').substring(0, 3).toUpperCase();
  const bvn = farmer.bvn ? farmer.bvn.substring(0, 4) : Math.floor(1000 + Math.random() * 9000).toString();
  const date = new Date(farmer.registrationDate || Date.now()).getFullYear().toString().substring(2);
  const state = (farmer.state || 'ST').substring(0, 2).toUpperCase();
  const lga = (farmer.lga || 'LG').substring(0, 2).toUpperCase();
  let gender = 'U';
  if (farmer.gender) {
    const g = farmer.gender.toUpperCase();
    if (g === 'MALE' || g === 'M') gender = 'M';
    else if (g === 'FEMALE' || g === 'F') gender = 'F';
  }
  
  return `${org}-${bvn}-${date}-${state}${lga}-${gender}`;
};

export const useFarmerStore = create<FarmerState>((set, get) => {
  // Setup listener
  onSnapshot(collection(db, 'farmers'), (snapshot) => {
    const farmers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Farmer));
    const mockedFarmers = farmers.map(f => {
      // Force coordinates to correspond with the state indicated in their profile
      if (f.state && STATE_COORDS[f.state]) {
         const stateCenter = STATE_COORDS[f.state];
         const latNum = parseFloat(f.latitude as any);
         const lngNum = parseFloat(f.longitude as any);
         // 3.0 degrees is a generous radius (approx 330km) ensuring we don't accidentally override valid locations within the state,
         // but we do catch the wildly random ones that were placed in completely different regions of Nigeria.
         const hasValidLat = !isNaN(latNum) && Math.abs(latNum - stateCenter.lat) < 3.0;
         const hasValidLng = !isNaN(lngNum) && Math.abs(lngNum - stateCenter.lng) < 3.0;
         
         if (!hasValidLat || !hasValidLng) {
           // We assign them closer to the center of their state so it visually matches
           f.latitude = stateCenter.lat + (Math.random() - 0.5) * 1.0;
           f.longitude = stateCenter.lng + (Math.random() - 0.5) * 1.0;
         }
      } else if (!f.latitude || !f.longitude) {
         const minLat = 4.0; const maxLat = 13.0; const minLng = 3.0; const maxLng = 14.0;
         f.latitude = minLat + Math.random() * (maxLat - minLat);
         f.longitude = minLng + Math.random() * (maxLng - minLng);
      }
      if (!f.farmSize) f.farmSize = parseFloat((0.5 + Math.random() * 0.5).toFixed(2));
      return f;
    });
    set({ farmers: mockedFarmers, isLoading: false });
  }, (error) => {
    console.error("Error loading farmers:", error);
    set({ isLoading: false });
  });

  return {
    farmers: [],
    isLoading: true,
        addFarmer: async (farmer) => {
      const valResult = farmerSchema.safeParse(farmer);
      if (!valResult.success) throw new Error('Validation failed: ' + valResult.error.message);

      const newFarmer: any = { 
         ...farmer, 
         farmerID: farmer.farmerID || generateFarmerID(farmer),
        creditScore: calculateCreditScore(farmer) 
       };
      Object.keys(newFarmer).forEach(key => {
        if (newFarmer[key] === undefined) delete newFarmer[key];
      });

      const docRef = doc(collection(db, 'farmers'));
      newFarmer.id = docRef.id;

      // Optimistic UI Update
      set((state) => ({
        farmers: [newFarmer as Farmer, ...state.farmers]
      }));

      // Fire and forget
      setDoc(docRef, newFarmer).catch(err => console.error("Failed to add farmer", err));
      
      useActivityLogStore.getState().logActivity({
        action: 'CREATE',
        entityType: 'FARMER',
        entityId: newFarmer.id,
        details: `Added new farmer: ${newFarmer.firstName} ${newFarmer.lastName}`
      });
    },
        updateFarmer: async (id, updates) => {
      // For updates, we can use a partial schema
      const valResult = farmerSchema.partial().safeParse(updates);
      if (!valResult.success) throw new Error('Validation failed: ' + valResult.error.message);

      const docRef = doc(db, 'farmers', id);
      const current = get().farmers.find(f => f.id === id);
      if (current) {
        const updatedFarmer: any = { ...current, ...updates };
        if (updates.farmSize !== undefined || updates.experience !== undefined || updates.kycComplete !== undefined) {
           updatedFarmer.creditScore = calculateCreditScore(updatedFarmer);
        }
        Object.keys(updatedFarmer).forEach(key => {
          if (updatedFarmer[key] === undefined) delete updatedFarmer[key];
        });

        // Optimistic UI Update
        set((state) => ({
          farmers: state.farmers.map(f => f.id === id ? { ...f, ...updatedFarmer } as Farmer : f)
        }));

        // Fire and forget Firestore update to avoid blocking
        updateDoc(docRef, updatedFarmer as any).catch(err => console.error("Failed to update farmer", err));
        
        const details = updates.interventions && updates.interventions.length > (current.interventions?.length || 0)
          ? `Added new intervention for farmer: ${current.firstName} ${current.lastName}`
          : `Updated farmer: ${current.firstName} ${current.lastName}`;

        const changes: { field: string; oldValue: any; newValue: any }[] = [];
        for (const [key, value] of Object.entries(updatedFarmer)) {
            // Ignore functions or complex non-serializable, but here it's mostly plain objects/strings
            if (JSON.stringify(current[key as keyof Farmer]) !== JSON.stringify(value)) {
                changes.push({
                    field: key,
                    oldValue: current[key as keyof Farmer],
                    newValue: value
                });
            }
        }

        useActivityLogStore.getState().logActivity({
          action: 'UPDATE',
          entityType: 'FARMER',
          entityId: id,
          details,
          changes
        });
      }
    },

    bulkAddFarmers: async (newFarmers) => {
      const batches = [];
      let currentBatch = writeBatch(db);
      let count = 0;
      const existingFarmers = get().farmers;
      
      for (const farmer of newFarmers) {
        // Find if exists
        let existing = undefined;
        if (farmer.id) existing = existingFarmers.find(f => f.id === farmer.id);
        if (!existing && farmer.farmerID) existing = existingFarmers.find(f => f.farmerID === farmer.farmerID);
        if (!existing && farmer.bvn) existing = existingFarmers.find(f => f.bvn === farmer.bvn);
        
        const processed: any = { 
          ...farmer, 
          farmerID: existing?.farmerID || farmer.farmerID || generateFarmerID(farmer),
          creditScore: calculateCreditScore(farmer) 
        };
        // Clean undefined values for Firestore
        Object.keys(processed).forEach(key => {
          if (processed[key] === undefined) {
            delete processed[key];
          }
        });
        
        let docRef;
        if (existing) {
          docRef = doc(db, 'farmers', existing.id);
          processed.id = existing.id;
          currentBatch.update(docRef, processed);
        } else {
          docRef = doc(collection(db, 'farmers'));
          processed.id = docRef.id;
          currentBatch.set(docRef, processed);
        }
        
        count++;
        if (count === 490) { // Keep under 500
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        batches.push(currentBatch.commit());
      }
      await Promise.all(batches);
      
      useActivityLogStore.getState().logActivity({
        action: 'BULK_IMPORT',
        entityType: 'FARMER',
        entityId: 'BULK',
        details: `Imported ${newFarmers.length} farmers via CSV/Sheets`
      });
    },
        deleteFarmer: async (id) => {
      const current = get().farmers.find(f => f.id === id);
      
      // Optimistic UI Update
      set((state) => ({
        farmers: state.farmers.filter(f => f.id !== id)
      }));

      // Fire and forget
      deleteDoc(doc(db, 'farmers', id)).catch(err => console.error("Failed to delete farmer", err));
      
      useActivityLogStore.getState().logActivity({
        action: 'DELETE',
        entityType: 'FARMER',
        entityId: id,
        details: `Deleted farmer: ${current?.firstName} ${current?.lastName}`
      });
    }
  };
});
