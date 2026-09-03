import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type Auth } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { deriveSessionState, type SessionState } from './sessionState';

/** See studio-mobile's identical file for the full rationale. */
interface AuthContextValue {
  session: SessionState;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const auth: Auth = useMemo(() => getFirebaseAuth(), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(deriveSessionState(user ? { uid: user.uid } : null));
    });
    return unsubscribe;
  }, [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, signOut: () => firebaseSignOut(auth) }),
    [session, auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
