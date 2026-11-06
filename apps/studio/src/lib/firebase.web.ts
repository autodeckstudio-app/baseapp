import { connectAuthEmulator } from "firebase/auth";
// Web build of the Firebase client (Metro picks *.web.ts for web). Same
// project and safety check as the native build; the session persists in the
// browser instead of AsyncStorage.
import { resolveAuthDomain } from "./auth-domain";
import { getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  initializeAuth,
  browserPopupRedirectResolver,
} from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

if (!__DEV__ && !process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"]) {
  throw new Error(
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID is not set in a production build - refusing to silently fall back to the dev Firebase project.",
  );
}

const firebaseConfig = {
  apiKey: process.env["EXPO_PUBLIC_FIREBASE_API_KEY"] ?? "demo-key",
  authDomain: resolveAuthDomain(
    process.env["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"] ??
      "autodeck-dev.firebaseapp.com",
    (globalThis as { location?: { host?: string } }).location?.host,
  ),
  projectId: process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"] ?? "autodeck-dev",
  storageBucket:
    process.env["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"] ??
    "autodeck-dev.firebasestorage.app",
  messagingSenderId:
    process.env["EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] ?? "000000000000",
  appId:
    process.env["EXPO_PUBLIC_FIREBASE_APP_ID"] ??
    "1:000000000000:web:demo-studio",
};

const app = getApps()[0] ?? initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const functions = getFunctions(app, "asia-south1");
export const useEmulator =
  process.env["EXPO_PUBLIC_USE_FIREBASE_EMULATOR"] === "true";
if (useEmulator) {
  const host = process.env["EXPO_PUBLIC_FIREBASE_EMULATOR_HOST"] ?? "localhost";
  try {
    connectAuthEmulator(
      auth,
      `http://${host}:${Number(process.env["EXPO_PUBLIC_AUTH_EMULATOR_PORT"] ?? "9099")}`,
      { disableWarnings: true },
    );
  } catch {}
  try {
    connectFirestoreEmulator(
      db,
      host,
      Number(process.env["EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT"] ?? "8080"),
    );
  } catch {}
  try {
    connectFunctionsEmulator(
      functions,
      host,
      Number(process.env["EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT"] ?? "5001"),
    );
  } catch {}
}
