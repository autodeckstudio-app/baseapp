/**
 * Customer authentication: Google sign-in only.
 *
 * The native Google SDK flow (see native-google-signin.ts)
 * returns a Google ID token; it is exchanged here for a Firebase session
 * with signInWithCredential. No password or phone number is collected.
 *
 * Google OAuth client IDs come from EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
 * (created in the Firebase project's Google Cloud console). Against the
 * Auth emulator a dev sign-in is available instead, since the emulator
 * accepts unsigned Google credentials and no client IDs are needed.
 */

import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  onIdTokenChanged as firebaseOnIdTokenChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLLECTIONS } from "@autodeck/database";
import { auth, db, functions, useEmulator, emulatorBackend } from "./firebase";

export interface GoogleClientIds {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
}

export function googleClientIds(): GoogleClientIds {
  const ids: GoogleClientIds = {};
  const web = process.env["EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"];
  const ios = process.env["EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"];
  const android = process.env["EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"];
  if (web) ids.webClientId = web;
  if (ios) ids.iosClientId = ios;
  if (android) ids.androidClientId = android;
  return ids;
}

export function googleSignInConfigured(): boolean {
  const ids = googleClientIds();
  return Boolean(ids.webClientId || ids.iosClientId || ids.androidClientId);
}

export { useEmulator };

/**
 * Web build: Firebase's own Google popup. The page's host must be one of the
 * Firebase project's authorized domains (the preview host is).
 */
export async function signInWithGooglePopup(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/** Exchanges a Google ID token from the native flow for a Firebase session. */
export async function signInWithGoogleIdToken(idToken: string): Promise<User> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}

/**
 * Emulator only: signs in as a Google account without contacting Google.
 * The Auth emulator accepts an unsigned JSON credential. Refuses to run
 * against a real project.
 */
export async function devGoogleSignIn(email: string, name: string): Promise<User> {
  // Fail-closed: the dev credential only exists against a VERIFIED emulator
  // backend - never just a set flag (see lib/firebase.ts emulatorBackend).
  if (!emulatorBackend) throw new Error("Dev sign-in is only available against a verified Firebase emulator backend.");
  const fakeToken = JSON.stringify({ sub: `dev-${email}`, email, email_verified: true, name });
  return signInWithGoogleIdToken(fakeToken);
}

/**
 * Calls the setupCustomerProfile Cloud Function to create or restore the profile
 * and set custom claims (role, tenantId). Staff and the studio owner keep their
 * staff role (the function uses the shared role resolver). After this call, force-refresh the
 * ID token so the app can access Firestore with correct tenant isolation.
 */
export type SetupResult =
  | { customer: Record<string, unknown>; isNew: boolean; customerId?: string }
  | { claimRequired: true; renewalRequired?: boolean };

export function isClaimRequired(r: SetupResult): r is { claimRequired: true; renewalRequired?: boolean } {
  return (r as { claimRequired?: boolean }).claimRequired === true;
}

export async function setupCustomerProfile(name?: string): Promise<SetupResult> {
  const fn = httpsCallable<{ name?: string }, SetupResult>(
    functions,
    "setupCustomerProfile",
  );
  const result = await fn(name !== undefined ? { name } : {});
  return result.data;
}

/**
 * Claims the walk-in record the studio created, with the one-time counter
 * code. The server also requires this account's verified Google email to
 * match the record, so the code alone never grants anything. Every failure
 * reads the same ("That code did not work. Check it with the studio.").
 */
export async function claimCustomerRecord(code: string): Promise<{ customerId: string }> {
  const fn = httpsCallable<{ code: string }, { customerId: string }>(functions, "claimCustomerRecord");
  const result = await fn({ code });
  return result.data;
}

/**
 * Force-refreshes the ID token (custom claims: role, tenantId) AND reloads
 * the user profile (displayName) so both are current after
 * setupCustomerProfile sets them server-side - a getIdToken(true) alone only
 * refreshes the token, not cached profile fields like displayName.
 * Must be called after setupCustomerProfile succeeds.
 */

/**
 * Canonical customer DOCUMENT id ownership probe (staff-first identity).
 *
 * Every record keys off the customer DOC id, which is NOT always the Auth
 * uid: a claimed walk-in record keeps its staged doc id. Client list queries
 * on customers are denied by design (per-doc binding rules), so the client
 * cannot discover the doc id on its own - it must come from context (the
 * booking/job it is looking at, or the setup/claim response). This probe
 * answers the only question a route needs: "is THIS customer doc id mine?"
 *
 * A readable doc is NOT proof: staff and admins can read tenant customer
 * docs too. Ownership is the DATA: authUid === this account's uid, tenantId
 * === this token's validated tenant claim, and not deleted. This account is
 * the customer app, but the data check is what makes that true rather than
 * assumed. Fail-closed on permission-denied, network errors, missing claims,
 * and any field mismatch.
 *
 * No result caching: a positive answer can go stale (deletion, admin
 * correction, account change) and a cache keyed by uid cannot see those
 * epochs. Each call is one billed read - UI gates call this rarely.
 * Server callables re-check everything; this is UI gating only.
 */
type OwnershipProbe = "mine" | "not-mine" | "error";
async function probeMyCustomerDoc(customerDocId: string): Promise<OwnershipProbe> {
  const user = auth.currentUser;
  if (!user || !customerDocId) return "not-mine";
  try {
    const tenantId = (await user.getIdTokenResult()).claims["tenantId"];
    if (typeof tenantId !== "string" || !tenantId) return "not-mine";
    const snap = await getDoc(doc(db, COLLECTIONS.customers(), customerDocId));
    if (!snap.exists()) return "not-mine";
    const d = snap.data() as { authUid?: unknown; tenantId?: unknown; deletedAt?: unknown };
    return d.authUid === user.uid && d.tenantId === tenantId && !d.deletedAt ? "mine" : "not-mine";
  } catch {
    // Network/AppCheck/permission transport failures are NOT "not mine":
    // callers that would otherwise fall through to a mutating path must stop.
    return "error";
  }
}

export async function verifyMyCustomerDocId(customerDocId: string): Promise<boolean> {
  return (await probeMyCustomerDoc(customerDocId)) === "mine";
}

/**
 * Fast path for the legacy shape (doc id == authUid). Returns uid when the
 * account's own doc sits at its uid, else null. Null does NOT mean the
 * account has no record - a claimed staged record's id comes from context
 * and is verified with verifyMyCustomerDocId - and null must NEVER be used
 * as a reason to create a new profile or record.
 */
export async function getMyCustomerDocId(): Promise<string | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  return (await verifyMyCustomerDocId(uid)) ? uid : null;
}

/**
 * Resolves the canonical customer DOCUMENT id for the signed-in account,
 * for list routes that must key reads by the record id, not the Auth uid.
 * Order: legacy fast path (doc at uid), then the persisted id from this
 * device's setup/claim, then the app's own idempotent setupCustomerProfile
 * call - the same callable the setup screen uses, which returns the existing
 * or claimed record's id (and for a brand-new account performs the app's
 * normal self-serve profile creation; it never merges records). Every
 * candidate is verified (authUid + tenant + not deleted) before use.
 * claimRequired returns null - the claim screen owns that state. Null must
 * NEVER be used as a reason to create anything.
 */
const DOC_ID_STORAGE_PREFIX = "autodeck.customerDocId.";
export async function resolveMyCustomerDocId(): Promise<string | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  // Principal-switch guard: every candidate is accepted only if the SAME
  // account is still signed in after the await that produced it.
  const current = () => auth.currentUser?.uid === uid;
  const fast = await probeMyCustomerDoc(uid);
  if (fast === "mine") return current() ? uid : null;
  if (fast === "error" || !current()) return null; // transient read failure: never fall through to a mutating call
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(DOC_ID_STORAGE_PREFIX + uid);
  } catch { /* storage unavailable - fall through to server resolution */ }
  if (stored && current()) {
    const probe = await probeMyCustomerDoc(stored);
    if (probe === "mine") return current() ? stored : null;
    if (probe === "error" || !current()) return null;
  }
  // Server semantics (verified in the callable): this returns the CLAIMED
  // profile for a claimed account, claimRequired for a known unclaimed
  // email, and only creates a profile for a genuinely new email - the app's
  // own self-serve path, never a parallel record for an existing email.
  let r: SetupResult;
  try {
    r = await setupCustomerProfile();
  } catch {
    return null; // terminal: the hook still reaches ready, the next token event retries
  }
  if (!current()) return null;
  if (isClaimRequired(r)) return null;
  const id = typeof r.customerId === "string" && r.customerId
    ? r.customerId
    : typeof (r.customer as { id?: unknown })?.id === "string"
      ? (r.customer as { id: string }).id
      : null;
  if (id) {
    const probe = await probeMyCustomerDoc(id);
    if (probe === "mine" && current()) {
      try { await AsyncStorage.setItem(DOC_ID_STORAGE_PREFIX + uid, id); } catch { /* best effort */ }
      return id;
    }
  }
  return null;
}

/** Persists the id at the moments the app already knows it (setup/claim). */
export async function rememberMyCustomerDocId(customerDocId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !customerDocId) return;
  try { await AsyncStorage.setItem(DOC_ID_STORAGE_PREFIX + uid, customerDocId); } catch { /* best effort */ }
}

export async function refreshAuthToken(): Promise<void> {
  await auth.currentUser?.getIdToken(true);
  await auth.currentUser?.reload();
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
  return firebaseOnAuthStateChanged(auth, callback);
}

/**
 * Fires on sign-in, sign-out, AND every ID-token refresh - unlike
 * onAuthStateChanged, which does not fire when getIdToken(true) picks up new
 * custom claims. Auth guards that read claims must subscribe to this,
 * otherwise a user whose claims were just set server-side (e.g. by
 * setupCustomerProfile) stays stuck on the pre-claims screen.
 */
export function onIdTokenChanged(callback: (user: User | null) => void): Unsubscribe {
  return firebaseOnIdTokenChanged(auth, callback);
}

export { auth };
