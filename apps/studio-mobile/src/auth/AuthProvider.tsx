import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type Auth } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { deriveSessionState, type SessionState } from './sessionState';

/**
 * Deliberately thin: all the authorization LOGIC lives in
 * `sessionState.ts`'s `deriveSessionState`, fully unit-tested without
 * touching Firebase. This component only wires that pure function to
 * Firebase Auth's real `onAuthStateChanged` listener. Session restoration
 * and the initial "loading" state both fall out of the SDK's own behavior
 * (the listener fires once, asynchronously, with the restored session or
 * `null`) — nothing invented here.
 */
interface AuthContextValue {
  session: SessionState;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const auth: Auth = useMemo(() => getFirebaseAuth(), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setSession(deriveSessionState(null, null));
        return;
      }
      const tokenResult = await user.getIdTokenResult();
      setSession(deriveSessionState({ uid: user.uid }, tokenResult.claims));
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
