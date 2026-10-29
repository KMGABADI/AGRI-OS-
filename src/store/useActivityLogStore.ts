import { create } from 'zustand';
import { collection, onSnapshot, doc, setDoc, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ActivityLogState, ActivityLog, UserProfile } from '../types';

export const useActivityLogStore = create<ActivityLogState>((set) => {
  const logsQuery = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(100));
  
  onSnapshot(logsQuery, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
    set({ logs });
  });

  return {
    logs: [],
    logActivity: async (logData) => {
      try {
        const user = auth.currentUser;
        if (!user) return; // Cannot log without a user

        let profile: UserProfile = {
           uid: user.uid,
           email: user.email || '',
           displayName: user.displayName || 'Unknown User',
           role: 'Viewer' // Fallback
        };

        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
           profile = docSnap.data() as UserProfile;
        }

        const docRef = doc(collection(db, 'activityLogs'));
        const newLog: ActivityLog = {
          ...logData,
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role,
          id: docRef.id,
          timestamp: new Date().toISOString()
        };
        await setDoc(docRef, newLog);
      } catch (error) {
        console.error("Failed to log activity:", error);
      }
    },
  };
});
