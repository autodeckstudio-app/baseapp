"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  type MultiFactorResolver,
  type User,
} from "firebase/auth";
import type { AutoDeckClaims } from "@autodeck/auth";
import { auth } from "./firebase";
import { isMultiFactorRequiredError, pickPhoneHint } from "./mfa";

// Phase 5B P1-15: DOM element id the invisible reCAPTCHA verifier attaches
// to during an MFA challenge. Must exist in the DOM before confirmMfaCode's
// underlying verifyPhoneNumber call — see login/page.tsx's hidden div.
export const MFA_RECAPTCHA_CONTAINER_ID = "admin-mfa-recaptcha-container";

interface AdminAuthState {
  user: User | null;
  claims: AutoDeckClaims | null;
  loading: boolean;
  error: string | null;
  mfaRequired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  confirmMfaCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

async function fetchSessionClaims(): Promise<AutoDeckClaims | null> {
  try {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    if (!res.ok) return null;
    const data = (await res.json()) as { claims: AutoDeckClaims };
    return data.claims;
  } catch {
    return null;
  }
}

async function exchangeIdTokenForSession(idToken: string): Promise<AutoDeckClaims | null> {
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { claims: AutoDeckClaims };
    return data.claims;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AutoDeckClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaVerificationId, setMfaVerificationId] = useState<string | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    // Reactive updates only (token refresh, sign-out in another tab). The
    // AUTHORITATIVE answer to "is this session still valid" is the httpOnly
    // session cookie, verified server-side — not whether the client SDK
    // still has a locally-cached Firebase Auth user (that's just a cache;
    // it has no way to know the cookie was revoked or never established).
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setError(null);
      if (!nextUser) {
        setUser(null);
        setClaims(null);
        setLoading(false);
        return;
      }

      const sessionClaims = await fetchSessionClaims();
      if (!sessionClaims) {
        // Client SDK still thinks it's signed in but the server session is
        // absent/expired/revoked — bring the two back into agreement
        // instead of leaving a dangling client-only session that can still
        // read Firestore directly.
        setUser(null);
        setClaims(null);
        setLoading(false);
        await firebaseSignOut(auth);
        return;
      }

      setUser(nextUser);
      setClaims(sessionClaims);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function establishServerSession(nextUser: User): Promise<void> {
    const idToken = await nextUser.getIdToken();
    const sessionClaims = await exchangeIdTokenForSession(idToken);
    if (!sessionClaims) {
      await firebaseSignOut(auth);
      setUser(null);
      setClaims(null);
      setError("This account does not have admin access.");
      setLoading(false);
      throw new Error("not-admin");
    }
    setUser(nextUser);
    setClaims(sessionClaims);
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await establishServerSession(credential.user);
    } catch (err) {
      // establishServerSession already set a precise error + cleared state
      // for this case — don't overwrite it with the generic message below.
      if (err instanceof Error && err.message === "not-admin") throw err;
      if (isMultiFactorRequiredError(err)) {
        const resolver = getMultiFactorResolver(auth, err);
        const hint = pickPhoneHint(resolver);
        if (!hint) {
          setError("This account's second factor is not supported by this app.");
          setLoading(false);
          throw new Error("unsupported-mfa-factor");
        }
        try {
          recaptchaVerifierRef.current ??= new RecaptchaVerifier(auth, MFA_RECAPTCHA_CONTAINER_ID, {
            size: "invisible",
          });
          const verificationId = await new PhoneAuthProvider(auth).verifyPhoneNumber(
            { multiFactorHint: hint, session: resolver.session },
            recaptchaVerifierRef.current,
          );
          setMfaResolver(resolver);
          setMfaVerificationId(verificationId);
          setLoading(false);
          return;
        } catch {
          setError("Could not send the verification code. Please try again.");
          setLoading(false);
          throw new Error("mfa-challenge-failed");
        }
      }
      setError("Invalid email or password.");
      setLoading(false);
      throw new Error("sign-in-failed");
    }
  }

  async function confirmMfaCode(code: string) {
    if (!mfaResolver || !mfaVerificationId) {
      throw new Error("no-pending-mfa-challenge");
    }
    setError(null);
    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(mfaVerificationId, code);
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      const userCredential = await mfaResolver.resolveSignIn(assertion);
      setMfaResolver(null);
      setMfaVerificationId(null);
      await establishServerSession(userCredential.user);
    } catch (err) {
      if (err instanceof Error && err.message === "not-admin") throw err;
      setError("Invalid verification code.");
      setLoading(false);
      throw new Error("mfa-confirm-failed");
    }
  }

  async function signOut() {
    await fetch("/api/session", { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
    await firebaseSignOut(auth);
    setUser(null);
    setClaims(null);
    setMfaResolver(null);
    setMfaVerificationId(null);
  }

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        claims,
        loading,
        error,
        mfaRequired: mfaResolver !== null,
        signIn,
        confirmMfaCode,
        signOut,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
