import { create } from 'zustand';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InterventionDoc } from '../types';
import { useActivityLogStore } from './useActivityLogStore';

interface InterventionState {
  interventions: Record<string, InterventionDoc[]>; // Keyed by farmerId
  fetchInterventions: (farmerId: string) => void;
  addIntervention: (farmerId: string, intervention: InterventionDoc) => Promise<void>;
  updateIntervention: (farmerId: string, interventionId: string, updates: Partial<InterventionDoc>) => Promise<void>;
  deleteIntervention: (farmerId: string, interventionId: string) => Promise<void>;
}

export const useInterventionStore = create<InterventionState>((set, get) => {
  const unsubscribers: Record<string, () => void> = {};

  return {
    interventions: {},
    fetchInterventions: (farmerId) => {
      if (unsubscribers[farmerId]) return;
      const unsubscribe = onSnapshot(collection(db, 'farmers', farmerId, 'interventions'), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InterventionDoc));
        set(state => ({ interventions: { ...state.interventions, [farmerId]: data } }));
      });
      unsubscribers[farmerId] = unsubscribe;
    },
    addIntervention: async (farmerId, intervention) => {
      const docRef = doc(collection(db, 'farmers', farmerId, 'interventions'));
      const newIntervention = { ...intervention, id: docRef.id };
      await setDoc(docRef, newIntervention);
      
      useActivityLogStore.getState().logActivity({
        action: 'CREATE',
        entityType: 'INTERVENTION',
        entityId: newIntervention.id,
        details: `Added new intervention for farmer ${farmerId}`
      });
    },
    updateIntervention: async (farmerId, interventionId, updates) => {
      const docRef = doc(db, 'farmers', farmerId, 'interventions', interventionId);
      await updateDoc(docRef, updates as any);
      
      const currentList = get().interventions[farmerId] || [];
      const current = currentList.find(i => i.id === interventionId);
      const changes: { field: string; oldValue: any; newValue: any }[] = [];
      if (current) {
        for (const [key, value] of Object.entries(updates)) {
          if (JSON.stringify(current[key as keyof typeof current]) !== JSON.stringify(value)) {
            changes.push({
              field: key,
              oldValue: current[key as keyof typeof current],
              newValue: value
            });
          }
        }
      }

      useActivityLogStore.getState().logActivity({
        action: 'UPDATE',
        entityType: 'INTERVENTION',
        entityId: interventionId,
        details: `Updated intervention for farmer ${farmerId}`,
        changes
      });
    },
    deleteIntervention: async (farmerId, interventionId) => {
      await deleteDoc(doc(db, 'farmers', farmerId, 'interventions', interventionId));
      
      useActivityLogStore.getState().logActivity({
        action: 'DELETE',
        entityType: 'INTERVENTION',
        entityId: interventionId,
        details: `Deleted intervention for farmer ${farmerId}`
      });
    }
  };
});
