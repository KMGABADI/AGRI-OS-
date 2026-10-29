import { create } from 'zustand';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Farmer } from '../types';
import { useFarmerStore } from './useFarmerStore';
import { farmerSchema } from '../lib/validation';

export interface StagingRecord {
  id: string;
  data: Partial<Farmer>;
  status: 'pending' | 'duplicate_warning' | 'error' | 'committed';
  errorReason?: string;
  duplicateOf?: string; // id of existing farmer
}

interface ImportStagingState {
  stagedRecords: StagingRecord[];
  stageImport: (records: Partial<Farmer>[]) => Promise<void>;
  commitRecord: (id: string, mergeWithDuplicate?: boolean) => Promise<void>;
  rejectRecord: (id: string) => Promise<void>;
  clearStaged: () => Promise<void>;
}

export const useImportStagingStore = create<ImportStagingState>((set, get) => {
  onSnapshot(collection(db, 'importStaging'), (snapshot) => {
    const stagedRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StagingRecord));
    set({ stagedRecords });
  });

  return {
    stagedRecords: [],
    stageImport: async (records) => {
      // Stub: in a real implementation this might just send to the server endpoint
      // We will actually just push them locally to the staging collection if done client-side,
      // but for this roadmap item (A5/A2), the server is parsing it and putting it into staging.
      // So this method might not be needed if upload directly goes to /api/connectors/import
    },
    commitRecord: async (id, mergeWithDuplicate = false) => {
      const record = get().stagedRecords.find(r => r.id === id);
      if (!record) return;

      if (mergeWithDuplicate && record.duplicateOf) {
        await useFarmerStore.getState().updateFarmer(record.duplicateOf, record.data);
      } else {
        await useFarmerStore.getState().addFarmer(record.data as Farmer);
      }
      await deleteDoc(doc(db, 'importStaging', id));
    },
    rejectRecord: async (id) => {
      await deleteDoc(doc(db, 'importStaging', id));
    },
    clearStaged: async () => {
      const records = get().stagedRecords;
      let currentBatch = writeBatch(db);
      let count = 0;
      let batches = [];
      for (const rec of records) {
        currentBatch.delete(doc(db, 'importStaging', rec.id));
        count++;
        if (count === 490) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) batches.push(currentBatch.commit());
      await Promise.all(batches);
    }
  };
});
