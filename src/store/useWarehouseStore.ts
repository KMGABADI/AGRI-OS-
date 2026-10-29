import { create } from 'zustand';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WarehouseState, Warehouse } from '../types';
import { useActivityLogStore } from './useActivityLogStore';

export const useWarehouseStore = create<WarehouseState>((set, get) => {
  onSnapshot(collection(db, 'warehouses'), (snapshot) => {
    const warehouses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
    set({ warehouses });
  });

  return {
    warehouses: [],
    addWarehouse: async (warehouse) => {
      const docRef = doc(collection(db, 'warehouses'));
      const newWarehouse = { ...warehouse, id: docRef.id };
      await setDoc(docRef, newWarehouse);
      
      useActivityLogStore.getState().logActivity({
        action: 'CREATE',
        entityType: 'WAREHOUSE',
        entityId: newWarehouse.id,
        details: `Added new warehouse: ${newWarehouse.name}`
      });
    },
    updateWarehouse: async (id, updates) => {
      const docRef = doc(db, 'warehouses', id);
      await updateDoc(docRef, updates as any);
      
      const current = get().warehouses.find(w => w.id === id);
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
        entityType: 'WAREHOUSE',
        entityId: id,
        details: `Updated warehouse: ${current?.name}`,
        changes
      });
    },
    deleteWarehouse: async (id) => {
      const current = get().warehouses.find(w => w.id === id);
      await deleteDoc(doc(db, 'warehouses', id));
      
      useActivityLogStore.getState().logActivity({
        action: 'DELETE',
        entityType: 'WAREHOUSE',
        entityId: id,
        details: `Deleted warehouse: ${current?.name}`
      });
    }
  };
});
