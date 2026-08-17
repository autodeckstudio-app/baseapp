/**
 * Phone OTP authentication service.
 *
 * PRODUCTION NOTE: Real SMS OTP delivery requires Firebase Blaze plan — REQUIRES APPROVAL.
 * Firebase Auth Emulator supports test phone numbers with NO SMS and NO billing.
 *
 * REACT NATIVE NOTE: The Firebase JS SDK RecaptchaVerifier requires a DOM (web-only).
 * For production React Native phone auth, use @react-native-firebase/auth with an Expo
 * custom dev build. The emulator mock verifier below is for development ONLY.
 *
 * Emulator test numbers (configure in firebase.json or emulator UI):
 *   +91 98765 43210  →  OTP: 123456
 *   +91 98765 43211  →  OTP: 123456
 */

import {
  PhoneAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  connectAuthEmulator,
  type User,
  type ConfirmationResult,
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

/**
 * Mock ApplicationVerifier for Firebase Auth Emulator.
 * The emulator ignores the captcha token for pre-configured test numbers.
 * DO NOT use in production — switch to @react-native-firebase/auth.
 */
class EmulatorPhoneVerifier {
  type = "recaptcha" as const;
  async verify(): Promise<string> {
    return "emulator-mock-captcha-token";
  }
}

/**
 * Sends a phone OTP to the given number.
 * In development: uses emulator test number (no actual SMS sent, no billing).
 * In production: real SMS requires Blaze plan — REQUIRES APPROVAL.
 *
 * Phone number must be in E.164 format: +91XXXXXXXXXX
 */
export async function sendPhoneOtp(phoneNumber: string): Promise<ConfirmationResult> {
  const provider = new PhoneAuthProvider(auth);

  if (!useEmulator) {
    // Production path — real SMS
    // REQUIRES APPROVAL: Blaze plan must be activated before this path is used
    throw new Error(
      "Production phone OTP is not yet enabled. Activate Firebase Blaze plan (REQUIRES APPROVAL) and switch to @react-native-firebase/auth for native phone OTP.",
    );
  }

  // Development path — emulator mock verifier (no SMS, no billing)
  const verifier = new EmulatorPhoneVerifier();
  const verificationId = await provider.verifyPhoneNumber(
    phoneNumber,
    verifier as unknown as import("firebase/auth").ApplicationVerifier,
  );

  // Return a ConfirmationResult-compatible object
  return {
    verificationId,
    confirm: async (otp: string) => {
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      return signInWithCredential(auth, credential);
    },
  };
}

/**
 * Confirms the OTP and completes sign-in.
 */
export async function confirmOtp(
  confirmationResult: ConfirmationResult,
  otp: string,
): Promise<User> {
  const credential = await confirmationResult.confirm(otp);
  return credential.user;
}

/**
 * Calls the setupCustomerProfile Cloud Function to create or restore the profile
 * and set custom claims (role, tenantId). After this call, force-refresh the
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
 * Force-refreshes the ID token so the client receives updated custom claims
 * (role, tenantId) set by the setupCustomerProfile Cloud Function.
 * Must be called after setupCustomerProfile succeeds.
 */
export async function refreshAuthToken(): Promise<void> {
  await auth.currentUser?.getIdToken(true);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
  return firebaseOnAuthStateChanged(auth, callback);
}

export { auth };
