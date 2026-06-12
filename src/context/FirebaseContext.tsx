import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

import { auth, db } from '../firebase';

interface FirebaseContextType {
  db: any;
  auth: any;
  user: User | null;
  loading: boolean;
  signInWithGoogle: (credentialToken: string) => Promise<any>;
  isFirebaseActive: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      console.log('AUTH STATE CHANGED:', u?.uid || null);
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (credentialToken: string) => {
    const credential = GoogleAuthProvider.credential(credentialToken);
    return signInWithCredential(auth, credential);
  };

  // Firestore is considered active whenever a user is signed in. The real
  // `db` and `auth` instances come straight from src/firebase.ts so every
  // consumer (MedicationContext, RoleContext, etc.) reads/writes against
  // the same Firestore project.
  const isFirebaseActive = !!user;

  return (
    <FirebaseContext.Provider
      value={{
        db,
        auth,
        user,
        loading,
        signInWithGoogle,
        isFirebaseActive,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within FirebaseProvider');
  }
  return context;
};
