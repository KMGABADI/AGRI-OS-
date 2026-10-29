import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length
  ? initializeApp({
      projectId: firebaseConfig.projectId,
    })
  : getApp();

export const adminAuth = getAuth(app);
export const adminDb = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
