import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const validateFarmerRefs = async (organizationId?: string, programId?: string) => {
  const missingRefs: string[] = [];
  
  if (organizationId) {
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
    if (!orgDoc.exists()) missingRefs.push('Organization');
  }
  
  if (programId) {
    const progDoc = await getDoc(doc(db, 'programs', programId));
    if (!progDoc.exists()) missingRefs.push('Program');
  }
  
  return {
    valid: missingRefs.length === 0,
    missingRefs
  };
};
