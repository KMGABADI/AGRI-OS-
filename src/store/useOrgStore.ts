import { create } from 'zustand';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OrganizationState, Organization } from '../types';

export const useOrgStore = create<OrganizationState>((set) => {
  onSnapshot(collection(db, 'organizations'), (snapshot) => {
    const organizations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
    set({ organizations });
  });

  return {
    organizations: [],
    addOrganization: async (org) => {
      const docRef = doc(collection(db, 'organizations'));
      const newOrg = { ...org, id: docRef.id };
      await setDoc(docRef, newOrg);
    },
  };
});
