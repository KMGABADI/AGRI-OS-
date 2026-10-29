import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FarmerSensitive } from '../types';

export const getFarmerSensitive = async (farmerId: string): Promise<FarmerSensitive | null> => {
  const docRef = doc(db, 'farmers', farmerId, 'sensitive', 'kyc');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as FarmerSensitive;
  }
  return null;
};

export const setFarmerSensitive = async (farmerId: string, data: FarmerSensitive): Promise<void> => {
  const docRef = doc(db, 'farmers', farmerId, 'sensitive', 'kyc');
  await setDoc(docRef, data, { merge: true });
};
