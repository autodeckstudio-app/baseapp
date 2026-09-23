/**
 * Customer authentication: Google sign-in only.
 *
 * The native Google flow (expo-auth-session, see app/(auth)/login.tsx)
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
  connectAuthEmulator,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions, useEmulator } from "./firebase";

// Connect auth emulator (called once, here rather than firebase.ts to avoid
// double-connection during React Native fast refresh)
let authEmulatorConnected = false;
if (useEmulator && !authEmulatorConnected) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    authEmulatorConnected = true;
  } catch {
    // Already connected
  }
}

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
  if (!useEmulator) throw new Error("Dev sign-in is only available against the Firebase emulator.");
  const fakeToken = JSON.stringify({ sub: `dev-${email}`, email, email_verified: true, name });
  return signInWithGoogleIdToken(fakeToken);
}

/**
 * Calls the setupCustomerProfile Cloud Function to create or restore the profile
 * and set custom claims (role, tenantId). Staff and the studio owner keep their
 * staff role (the function uses the shared role resolver). After this call, force-refresh the
 * ID token so the app can access Firestore with correct tenant isolation.
 */
export async function setupCustomerProfile(name?: string): Promise<{
  customer: Record<string, unknown>;
  isNew: boolean;
}> {
  const fn = httpsCallable<{ name?: string }, { customer: Record<string, unknown>; isNew: boolean }>(
    functions,
    "setupCustomerProfile",
  );
  const result = await fn(name !== undefined ? { name } : {});
  return result.data;
}

/**
 * Force-refreshes the ID token (custom claims: role, tenantId) AND reloads
 * the user profile (displayName) so both are current after
 * setupCustomerProfile sets them server-side — a getIdToken(true) alone only
 * refreshes the token, not cached profile fields like displayName.
 * Must be called after setupCustomerProfile succeeds.
 */
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

export { auth };
