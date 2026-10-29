import { create } from 'zustand';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ProgramState, Program } from '../types';

export const useProgramStore = create<ProgramState>((set) => {
  onSnapshot(collection(db, 'programs'), (snapshot) => {
    const programs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program));
    set({ programs });
  });

  return {
    programs: [],
    addProgram: async (program) => {
      const docRef = doc(collection(db, 'programs'));
      const newProgram = { ...program, id: docRef.id };
      await setDoc(docRef, newProgram);
    },
  };
});
