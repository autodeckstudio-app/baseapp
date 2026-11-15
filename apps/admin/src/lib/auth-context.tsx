"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  onIdTokenChanged,
  GoogleAuthProvider,
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
import { claimsForSignedInUser } from "./session-heal";

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
// underlying verifyPhoneNumber call - see login/page.tsx's hidden div.
export const MFA_RECAPTCHA_CONTAINER_ID = "admin-mfa-recaptcha-container";

interface AdminAuthState {
  user: User | null;
  claims: AutoDeckClaims | null;
  loading: boolean;
  error: string | null;
  mfaRequired: boolean;
  // Google sign-in stays in this window on every browser. The verified
  // redirect result is picked up on return; no orphan popup is created.
  signIn: () => Promise<"signed-in" | "mfa" | "redirect">;
  confirmMfaCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

// Scope triple used to detect a session cookie that is STALE relative to the
// refreshed ID token: the cookie alone is never proof of the latest role.
function scopeKey(c: { role?: unknown; tenantId?: unknown; studioId?: unknown }): string {
  return `${String(c.role ?? "")}|${String(c.tenantId ?? "")}|${String(c.studioId ?? "")}`;
}

// Server-returned session claims carry the VERIFIED principal (uid) alongside
// the role scope - see /api/session. A session whose uid does not match the
// current token's uid proves nothing and must be re-exchanged.
type SessionClaims = AutoDeckClaims & { uid?: string };

async function fetchSessionClaims(): Promise<SessionClaims | null> {
  try {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    if (!res.ok) return null;
    const data = (await res.json()) as { claims: SessionClaims };
    return data.claims;
  } catch {
    return null;
  }
}

// Asks the server to set this account's role claims from its verified
// email and the staff roster. Returns whether the claims changed.
let lastResolveStatus = 0;
async function resolveClaims(idToken: string): Promise<{ changed: boolean } | null> {
  lastResolveStatus = 0;
  try {
    const res = await fetch("/api/auth/resolve-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      credentials: "same-origin",
    });
    lastResolveStatus = res.status;
    if (!res.ok) return null;
    return (await res.json()) as { changed: boolean };
  } catch {
    return null;
  }
}

async function exchangeIdTokenForSession(idToken: string): Promise<SessionClaims | null> {
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { claims: SessionClaims };
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
  const signInFlightRef = useRef<Promise<"signed-in" | "mfa" | "redirect"> | null>(null);

  useEffect(() => {
    const returningFromRedirect = takeRedirectFlag();
    if (returningFromRedirect) signingInRef.current = true;
    // Reactive updates only (token refresh - INCLUDING a same-uid refresh
    // whose custom claims changed - and sign-out in another tab). This must
    // be onIdTokenChanged, not onAuthStateChanged: onAuthStateChanged does
    // not fire when a refreshed token carries new role/tenant/studio claims
    // for the same user, which would leave a stale operator scope on screen.
    // The AUTHORITATIVE answer to "is this session still valid" is the
    // httpOnly session cookie, verified server-side - not whether the client
    // SDK still has a locally-cached Firebase Auth user (that's just a cache;
    // it has no way to know the cookie was revoked or never established).
    // Sequenced: every token event is numbered and only the LATEST event may
    // publish state or sign out - a slow older resolution can never overwrite
    // a newer sign-in/sign-out/unmount, and an old FAILED event can never
    // firebaseSignOut a newer one. Every non-null event marks the session
    // verifying IMMEDIATELY (loading), so prior claims are not affirmable
    // while the newer token is being validated. Errors fail CLOSED.
    let authGen = 0;
    let active = true;
    const unsubscribe = onIdTokenChanged(auth, (nextUser) => {
      const my = ++authGen;
      const current = () => active && my === authGen;
      setError(null);
      if (!nextUser) {
        setUser(null);
        setClaims(null);
        if (!signingInRef.current) setLoading(false);
        return;
      }

      if (signingInRef.current) return;
      setLoading(true); // verifying: prior claims are not affirmable from here
      void (async () => {
        try {
          let tokenScope: string | null = null;
          try {
            const tokenResult = await nextUser.getIdTokenResult();
            if (!current()) return;
            tokenScope = scopeKey(tokenResult.claims as { role?: unknown; tenantId?: unknown; studioId?: unknown });
          } catch {
            tokenScope = null; // token scope unreadable: the old cookie is NOT proof - see below
          }
          if (!current()) return;

          let effective: SessionClaims | null;
          if (tokenScope === null) {
            // The token's scope could not be read, so no cookie comparison is
            // possible: BLOCK until the server binds the CURRENT token - the
            // old cookie alone is never accepted as proof. Re-exchange the
            // current token; on failure this fails closed below.
            try {
              const tok = await nextUser.getIdToken();
              if (!current()) return;
              effective = await exchangeIdTokenForSession(tok);
              if (!current()) return;
            } catch {
              effective = null;
            }
          } else {
            const sessionClaims = await claimsForSignedInUser<SessionClaims>({
              getIdToken: () => nextUser.getIdToken(),
              fetchSessionClaims,
              resolveClaims,
              exchangeIdToken: exchangeIdTokenForSession,
              refreshIdToken: () => nextUser.getIdToken(true),
              shouldContinue: current, // a superseded event never POSTs
            });
            if (!current()) return;
            effective = sessionClaims;
            if (effective && (effective.uid !== nextUser.uid || scopeKey(effective) !== tokenScope)) {
              // The cookie session is STALE or bound to ANOTHER PRINCIPAL
              // (claims without a matching uid prove nothing about which
              // account they belong to): re-exchange a force-refreshed token
              // and publish only what the server confirms for THIS uid.
              try {
                const fresh = await nextUser.getIdToken(true);
                if (!current()) return;
                effective = await exchangeIdTokenForSession(fresh);
                if (!current()) return;
              } catch {
                effective = null;
              }
            }
          }
          // Final binding check: whatever the source, publish only claims the
          // server bound to the CURRENT token's principal.
          if (effective && (effective.uid !== nextUser.uid||!["admin","superadmin","accountant"].includes(effective.role))) effective = null;
          if (!effective) {
            // Client SDK still thinks it's signed in but the server session is
            // absent/expired/revoked - bring the two back into agreement
            // instead of leaving a dangling client-only session that can still
            // read Firestore directly. Only the LATEST event ever signs out.
            if (!current()) return;
            setUser(null);
            setClaims(null);
            setLoading(false);
            await firebaseSignOut(auth);
            return;
          }

          setUser(nextUser);
          setClaims(effective);
          setLoading(false);
        } catch {
          // Unexpected failure: fail CLOSED, current-only - never leave the
          // session stuck verifying and never publish on a stale generation.
          if (!current()) return;
          setUser(null);
          setClaims(null);
          setLoading(false);
        }
      })();
    });

    // Revalidate the host session on return and while this tab is visible. No account-wide revocation.
    let checkingHostSession=false;
    const recheckHostSession=async()=>{if(!active||checkingHostSession||signingInRef.current||!auth.currentUser||document.visibilityState==="hidden")return;checkingHostSession=true;const nextUser=auth.currentUser,my=authGen;try{const session=await fetchSessionClaims();if(!active||my!==authGen)return;if(!session||session.uid!==nextUser.uid||!["admin","superadmin","accountant"].includes(session.role)){++authGen;setUser(null);setClaims(null);setLoading(false);setError("Admin access is unavailable. Studio staff should use the Studio app.");}else{setUser(nextUser);setClaims(session)}}finally{checkingHostSession=false}};
    const focusRecheck=()=>{void recheckHostSession()};
    if(typeof window!=="undefined")window.addEventListener("focus",focusRecheck);
    if(typeof document!=="undefined")document.addEventListener("visibilitychange",focusRecheck);
    const hostSessionTimer=typeof window!=="undefined"?window.setInterval(focusRecheck,60000):null;

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

    return () => { active = false; unsubscribe();if(typeof window!=="undefined"){window.removeEventListener("focus",focusRecheck);if(hostSessionTimer!==null)window.clearInterval(hostSessionTimer);}if(typeof document!=="undefined")document.removeEventListener("visibilitychange",focusRecheck); };
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
          ? lastResolveStatus === 503 || lastResolveStatus === 500
            ? process.env.NODE_ENV === "production"
              ? "Access check is unavailable right now. Please try again in a minute."
              : "The admin server has no Firebase credentials. Put the service-account key in .env.local as FIREBASE_SERVICE_ACCOUNT_KEY (one line of JSON) and restart."
            : "Could not check this account's access. Please try again."
          : "This Google account's email is not verified.",
      );
      setLoading(false);
      throw new Error("not-admin");
    }
    if (resolved.changed) idToken = await nextUser.getIdToken(true);
    const sessionClaims = await exchangeIdTokenForSession(idToken);
    if (!sessionClaims || sessionClaims.uid !== nextUser.uid||!["admin","superadmin","accountant"].includes(sessionClaims.role)) {
      await firebaseSignOut(auth);
      setUser(null);
      setClaims(null);
      setError(
        "This account does not have Admin access. Studio staff should use the Studio app.",
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

  function signIn(): Promise<"signed-in" | "mfa" | "redirect"> {
    // The ref, not a render-time disabled button, is the duplicate-attempt gate.
    if (signInFlightRef.current) return signInFlightRef.current;
    setError(null);
    setLoading(true);
    signingInRef.current = true;
    const attempt = startRedirect().catch((err: unknown) => {
      signingInRef.current = false;
      signInFlightRef.current = null;
      try { sessionStorage.removeItem(REDIRECT_FLAG); } catch { /* storage unavailable */ }
      const code = errorCode(err);
      setError(code === "auth/unauthorized-domain"
        ? `Sign-in isn't enabled for ${window.location.hostname} yet. Add it under Firebase Authentication > Settings > Authorized domains.`
        : code === "auth/operation-not-allowed"
          ? "Google sign-in isn't turned on for this project yet."
          : "Could not open Google sign-in. Please try again.");
      setLoading(false);
      throw err;
    });
    signInFlightRef.current = attempt;
    return attempt;
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
