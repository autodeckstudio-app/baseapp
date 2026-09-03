'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type Auth } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { deriveSessionState, type SessionState } from './sessionState';

/**
 * Deliberately thin: all the actual authorization LOGIC lives in
 * `sessionState.ts`'s `deriveSessionState`, which is fully unit-tested
 * without touching Firebase at all. This component only wires that pure
 * function to Firebase Auth's real `onAuthStateChanged` listener — so
 * "does the session-state derivation follow the right rules" and "is the
 * Firebase listener wired correctly" are two separately-verifiable
 * concerns, not tangled together.
 *
 * `onAuthStateChanged` fires once synchronously-ish on mount with the
 * restored session (or `null`) — that single callback is what gives us
 * "loading" for the brief window before it fires, then "authenticated" or
 * "unauthenticated" — i.e. session restoration and the initial loading
 * state fall out of the SDK's own behavior, not anything invented here.
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
    () => ({
      session,
      signOut: () => firebaseSignOut(auth),
    }),
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
