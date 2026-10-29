import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/documents');
provider.addScope('https://www.googleapis.com/auth/documents.readonly');
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://mail.google.com/');
provider.addScope('https://www.googleapis.com/auth/documents');
provider.addScope('https://www.googleapis.com/auth/presentations');
provider.addScope('https://www.googleapis.com/auth/forms');
provider.addScope('https://www.googleapis.com/auth/contacts');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && !user.isAnonymous) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const DEFAULT_ADMIN_USER = {
  uid: 'superadmin-user',
  email: 'kmgabadi@gmail.com',
  displayName: 'Kumuri Gabadi',
  photoURL: '',
  isAnonymous: false,
} as unknown as User;

export const DEFAULT_ADMIN_PROFILE: UserProfile = {
  uid: 'superadmin-user',
  email: 'kmgabadi@gmail.com',
  displayName: 'Kumuri Gabadi',
  role: 'Super Admin',
  accessLevel: 5,
  permissions: [
    'view_dashboard',
    'manage_farmers',
    'view_map',
    'manage_warehouses',
    'manage_foodbank',
    'manage_uploads',
    'manage_organizations',
    'view_activity',
    'manage_settings'
  ],
  photoURL: ''
};

export const guestSignIn = async () => {
  try {
    isSigningIn = true;
    await signInAnonymously(auth);
  } catch (error) {
    console.warn('Guest sign in error, using default superadmin access:', error);
    window.dispatchEvent(new Event('local-guest-login'));
  } finally {
    isSigningIn = false;
  }
};

export const emailSignIn = async (email: string, password: string): Promise<{ user: User } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user };
  } catch (error: any) {
    console.error('Email sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const emailSignUp = async (email: string, password: string): Promise<{ user: User } | null> => {
  try {
    isSigningIn = true;
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return { user: result.user };
  } catch (error: any) {
    console.error('Email sign up error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out error:', err);
  }
  cachedAccessToken = null;
  window.location.href = '/login';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(DEFAULT_ADMIN_USER);
  const [profile, setProfile] = useState<UserProfile | null>(DEFAULT_ADMIN_PROFILE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleLocalGuest = () => {
      setUser(DEFAULT_ADMIN_USER);
      setProfile(DEFAULT_ADMIN_PROFILE);
      setLoading(false);
    };
    window.addEventListener('local-guest-login', handleLocalGuest);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        try {
          if (currentUser.isAnonymous) {
            setProfile(DEFAULT_ADMIN_PROFILE);
            setLoading(false);
            return;
          }

          // Fetch or create profile
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            let existingProfile = docSnap.data() as UserProfile;
            if (currentUser.email === 'kmgabadi@gmail.com' || currentUser.displayName?.toLowerCase() === 'kumuri gabadi') {
              existingProfile = {
                ...existingProfile,
                role: 'Super Admin',
                accessLevel: 5
              };
            }
            setProfile(existingProfile);
          } else {
            const isSuper = currentUser.email === 'kmgabadi@gmail.com' || currentUser.displayName?.toLowerCase() === 'kumuri gabadi';
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              role: isSuper ? 'Super Admin' : 'Admin',
              accessLevel: 5,
              permissions: DEFAULT_ADMIN_PROFILE.permissions,
              photoURL: currentUser.photoURL || ''
            };
            try {
              await setDoc(docRef, newProfile);
            } catch (saveErr) {
              console.warn('Could not save user profile to db:', saveErr);
            }
            setProfile(newProfile);
          }
        } catch (error: any) {
          console.warn('Falling back to default super admin profile:', error);
          setProfile(DEFAULT_ADMIN_PROFILE);
        } finally {
          setLoading(false);
        }
      } else {
        // Without login, default to full access Super Admin
        setUser(DEFAULT_ADMIN_USER);
        setProfile(DEFAULT_ADMIN_PROFILE);
        setLoading(false);
      }
    });

    return () => {
      window.removeEventListener('local-guest-login', handleLocalGuest);
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
