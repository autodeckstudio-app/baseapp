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
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  onIdTokenChanged as firebaseOnIdTokenChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
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

/**
 * Web build where popups cannot report back (in-app webviews, iOS Safari):
 * full-page redirect sign-in, the same pattern the Admin app runs in
 * production. signInWithRedirect leaves the page; the session is picked up
 * on return via the usual auth listeners.
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithRedirect(auth, provider);
}

/**
 * Resolves a pending redirect sign-in after the page reloads so its error
 * can be shown. A successful result also reaches the onIdTokenChanged
 * listener in useAuth, which runs the same post-sign-in resolution a
 * successful popup runs today - no new side effects.
 */
export async function completeGoogleRedirect(): Promise<void> {
  await getRedirectResult(auth);
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
/**
 * Resolution outcome, kept distinct so routes can tell the truth:
 * "resolved" - a verified canonical record id; "absent" - every candidate
 * verifiably missed (for a customer that means pre-setup/claim-pending);
 * "error" - a transient read failure, so the record state is UNKNOWN and
 * must never render as genuinely empty; "claim-required" - the server says
 * this email has an unclaimed record, and the claim screen owns that state.
 */
export type CustomerDocResolution =
  | { outcome: "resolved"; customerDocId: string }
  | { outcome: "absent" }
  | { outcome: "error" }
  | { outcome: "claim-required" };

const DOC_ID_STORAGE_PREFIX = "autodeck.customerDocId.";

/**
 * Shared resolution walk. allowSetup=false is the READ-ONLY staff path: it
 * stops after the verified candidates and NEVER calls setupCustomerProfile,
 * so resolving a staff account can never create a record.
 */
async function resolveCustomerDocIdState(allowSetup: boolean): Promise<CustomerDocResolution> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { outcome: "absent" };
  // Principal-switch guard: every candidate is accepted only if the SAME
  // account is still signed in after the await that produced it.
  const current = () => auth.currentUser?.uid === uid;
  const fast = await probeMyCustomerDoc(uid);
  if (fast === "mine") return current() ? { outcome: "resolved", customerDocId: uid } : { outcome: "error" };
  if (fast === "error" || !current()) return { outcome: "error" }; // transient read failure: never fall through to a mutating call
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(DOC_ID_STORAGE_PREFIX + uid);
  } catch { /* storage unavailable - fall through to server resolution */ }
  if (stored && current()) {
    const probe = await probeMyCustomerDoc(stored);
    if (probe === "mine") return current() ? { outcome: "resolved", customerDocId: stored } : { outcome: "error" };
    if (probe === "error" || !current()) return { outcome: "error" };
  }
  if (!allowSetup) {
    // New-device discovery for staff: a claimed server-generated record id
    // unknown to this device (never persisted here). One narrow READ-ONLY
    // query on the account's OWN authUid+tenant; every candidate is still
    // probe-verified. Exactly one resolves (and persists for next launch);
    // zero is a founded "absent"; more than one is ambiguous - truthful
    // "error", never a guess. No writes, no setup callable, no widening
    // beyond the account's own authUid+tenant.
    let tenantId: string | null = null;
    try {
      const t = (await auth.currentUser?.getIdTokenResult())?.claims["tenantId"];
      tenantId = typeof t === "string" && t ? t : null;
    } catch {
      return { outcome: "error" };
    }
    if (!tenantId || !current()) return { outcome: "error" };
    let candidates: string[];
    try {
      const qs = await getDocs(query(
        collection(db, COLLECTIONS.customers()),
        where("authUid", "==", uid),
        where("tenantId", "==", tenantId),
        limit(3),
      ));
      if (!current()) return { outcome: "error" };
      candidates = qs.docs
        .filter((d) => !(d.data() as { deletedAt?: unknown }).deletedAt)
        .map((d) => d.id);
    } catch {
      return { outcome: "error" };
    }
    if (candidates.length === 1) {
      const candidate = candidates[0] as string;
      const probe = await probeMyCustomerDoc(candidate);
      if (probe === "mine") {
        // A principal switch mid-probe is a superseded attempt, never an
        // absence: "absent" would grant the new principal a legacy-self key.
        if (!current()) return { outcome: "error" };
        try { await AsyncStorage.setItem(DOC_ID_STORAGE_PREFIX + uid, candidate); } catch { /* best effort */ }
        return { outcome: "resolved", customerDocId: candidate };
      }
      if (!current()) return { outcome: "error" };
      return { outcome: probe === "error" ? "error" : "absent" };
    }
    if (candidates.length > 1) return { outcome: "error" }; // ambiguous: never pick
    return { outcome: "absent" };
  }
  // Server semantics (verified in the callable): this returns the CLAIMED
  // profile for a claimed account, claimRequired for a known unclaimed
  // email, and only creates a profile for a genuinely new email - the app's
  // own self-serve path, never a parallel record for an existing email.
  let r: SetupResult;
  try {
    r = await setupCustomerProfile();
  } catch {
    return { outcome: "error" }; // terminal: the hook still reaches ready, the next token event retries
  }
  if (!current()) return { outcome: "error" };
  if (isClaimRequired(r)) return { outcome: "claim-required" };
  const id = typeof r.customerId === "string" && r.customerId
    ? r.customerId
    : typeof (r.customer as { id?: unknown })?.id === "string"
      ? (r.customer as { id: string }).id
      : null;
  if (id) {
    const probe = await probeMyCustomerDoc(id);
    if (probe === "mine") {
      if (!current()) return { outcome: "error" }; // superseded, never absent
      try { await AsyncStorage.setItem(DOC_ID_STORAGE_PREFIX + uid, id); } catch { /* best effort */ }
      return { outcome: "resolved", customerDocId: id };
    }
    if (!current()) return { outcome: "error" };
    if (probe === "error") return { outcome: "error" };
  }
  return { outcome: "absent" };
}

/** Legacy wrapper: the id, or null for every non-resolved outcome. */
export async function resolveMyCustomerDocId(): Promise<string | null> {
  const r = await resolveMyCustomerDocResolution();
  return r.outcome === "resolved" ? r.customerDocId : null;
}

/**
 * CUSTOMER-role resolution with the truthful outcome: full walk including
 * the app's own self-serve setupCustomerProfile fall-through.
 */
export async function resolveMyCustomerDocResolution(): Promise<CustomerDocResolution> {
  return resolveCustomerDocIdState(true);
}

/**
 * STAFF-role resolution, READ-ONLY: a staff account can own a genuine
 * customer record (legacy doc at uid, or a claimed staged id persisted on
 * this device), and this resolves it with the same verified-ownership bar -
 * but it never calls setupCustomerProfile, so it can never create, merge or
 * backfill anything. "absent" means verifiably no record; "error" means
 * unknown, not empty.
 */
export async function resolveExistingCustomerDocId(): Promise<CustomerDocResolution> {
  return resolveCustomerDocIdState(false);
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
