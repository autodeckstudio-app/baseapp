"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
import { currentUserAgent, isInAppBrowser, shouldFallBackToRedirect } from "./browser";

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always show the account chooser: staff often have a personal and a
  // studio Google account on the same device.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

// Marks a redirect sign-in in flight across the page reload, so the
// returning page holds off the "no session" sign-out until the redirect
// result is processed.
const REDIRECT_FLAG = "autodeck:google-redirect";

async function startRedirect(): Promise<"redirect"> {
  try {
    sessionStorage.setItem(REDIRECT_FLAG, "1");
  } catch {
    // storage unavailable; the fallback below still works, just less smoothly
  }
  await signInWithRedirect(auth, googleProvider());
  return "redirect";
}

function takeRedirectFlag(): boolean {
  try {
    const had = sessionStorage.getItem(REDIRECT_FLAG) === "1";
    sessionStorage.removeItem(REDIRECT_FLAG);
    return had;
  } catch {
    return false;
  }
}

function errorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

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
  // Google sign-in. Resolves "redirect" when the browser is being sent to
  // Google (in-app webviews); the result is picked up on return.
  signIn: () => Promise<"signed-in" | "mfa" | "redirect">;
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

// Asks the server to set this account's role claims from its verified
// email and the staff roster. Returns whether the claims changed.
async function resolveClaims(idToken: string): Promise<{ changed: boolean } | null> {
  try {
    const res = await fetch("/api/auth/resolve-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    return (await res.json()) as { changed: boolean };
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
  // True while a sign-in is between "Firebase has a user" and "the server
  // session exists". onAuthStateChanged fires inside that window and must
  // not treat the missing cookie as a revoked session.
  const signingInRef = useRef(false);

  useEffect(() => {
    const returningFromRedirect = takeRedirectFlag();
    if (returningFromRedirect) signingInRef.current = true;
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

      if (signingInRef.current) return;
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

    // Returning from a redirect sign-in (in-app browsers): finish it the
    // same way the popup path does.
    void getRedirectResult(auth)
      .then(async (result) => {
        if (!result) {
          if (returningFromRedirect) {
            signingInRef.current = false;
            setLoading(false);
          }
          return;
        }
        setLoading(true);
        await establishServerSession(result.user);
      })
      .catch(async (err: unknown) => {
        signingInRef.current = false;
        if (err instanceof Error && err.message === "not-admin") return;
        if (isMultiFactorRequiredError(err)) {
          await handleMfaError(err).catch(() => undefined);
          return;
        }
        setError("Google sign-in failed. Please try again.");
        setLoading(false);
      });

    return unsubscribe;
  }, []);

  async function establishServerSession(nextUser: User): Promise<void> {
    signingInRef.current = true;
    try {
      await establishServerSessionInner(nextUser);
    } finally {
      signingInRef.current = false;
    }
  }

  async function establishServerSessionInner(nextUser: User): Promise<void> {
    let idToken = await nextUser.getIdToken();
    const resolved = await resolveClaims(idToken);
    if (!resolved) {
      await firebaseSignOut(auth);
      setUser(null);
      setClaims(null);
      setError(
        nextUser.emailVerified
          ? "Could not check this account's access. Please try again."
          : "This Google account's email is not verified.",
      );
      setLoading(false);
      throw new Error("not-admin");
    }
    if (resolved.changed) idToken = await nextUser.getIdToken(true);
    const sessionClaims = await exchangeIdTokenForSession(idToken);
    if (!sessionClaims) {
      await firebaseSignOut(auth);
      setUser(null);
      setClaims(null);
      setError(
        "This Google account isn't on the AutoDeck staff roster. Ask the studio owner to add your Gmail address, then sign in again.",
      );
      setLoading(false);
      throw new Error("not-admin");
    }
    setUser(nextUser);
    setClaims(sessionClaims);
    setLoading(false);
  }

  async function handleMfaError(err: unknown): Promise<"mfa"> {
    const resolver = getMultiFactorResolver(auth, err as Parameters<typeof getMultiFactorResolver>[1]);
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
      return "mfa";
    } catch {
      setError("Could not send the verification code. Please try again.");
      setLoading(false);
      throw new Error("mfa-challenge-failed");
    }
  }

  async function signIn(): Promise<"signed-in" | "mfa" | "redirect"> {
    setError(null);
    setLoading(true);
    if (isInAppBrowser(currentUserAgent())) return startRedirect();
    signingInRef.current = true;
    try {
      const credential = await signInWithPopup(auth, googleProvider());
      await establishServerSession(credential.user);
      return "signed-in";
    } catch (err) {
      // establishServerSession already set a precise error + cleared state
      // for this case — don't overwrite it with the generic message below.
      signingInRef.current = false;
      if (err instanceof Error && err.message === "not-admin") throw err;
      if (isMultiFactorRequiredError(err)) return handleMfaError(err);
      const code = errorCode(err);
      if (shouldFallBackToRedirect(code)) return startRedirect();
      setError(
        code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"
          ? null
          : code === "auth/unauthorized-domain"
            ? `Sign-in isn't enabled for ${window.location.hostname} yet. Add it under Firebase Authentication > Settings > Authorized domains.`
            : code === "auth/operation-not-allowed"
              ? "Google sign-in isn't turned on for this project yet."
              : `Google sign-in failed (${code ?? "unknown error"}). Please try again.`,
      );
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
      signingInRef.current = true;
      const userCredential = await mfaResolver.resolveSignIn(assertion);
      setMfaResolver(null);
      setMfaVerificationId(null);
      await establishServerSession(userCredential.user);
    } catch (err) {
      signingInRef.current = false;
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
