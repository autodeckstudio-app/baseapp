// Web build of the Firebase client (Metro picks *.web.ts for web). Same
// project and safety check as the native build; the session persists in the
// browser instead of AsyncStorage.
import { resolveAuthDomain } from "./auth-domain";
import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, initializeAuth, browserPopupRedirectResolver } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { emulatorTargets, resolveUseEmulator } from "./emulator-flag";

if (!__DEV__ && !process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"]) {
  throw new Error(
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID is not set in a production build - refusing to silently fall back to the dev Firebase project.",
  );
}

const firebaseConfig = {
  apiKey: process.env["EXPO_PUBLIC_FIREBASE_API_KEY"] ?? "demo-key",
  authDomain: resolveAuthDomain(
    process.env["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"] ?? "autodeck-dev.firebaseapp.com",
    (globalThis as { location?: { host?: string } }).location?.host,
  ),
  projectId: process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"] ?? "autodeck-dev",
  storageBucket: process.env["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"] ?? "autodeck-dev.firebasestorage.app",
  messagingSenderId: process.env["EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] ?? "000000000000",
  appId: process.env["EXPO_PUBLIC_FIREBASE_APP_ID"] ?? "1:000000000000:web:demo",
};

const app = getApps()[0] ?? initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-south1");
export const storage = getStorage(app);

// NOTE: direct process.env["..."] reads only - Expo's web export inlines
// EXPO_PUBLIC_* variables per access site and cannot see through a
// passed-around process.env object. Production builds set neither flag,
// so the emulator stays off there.
export const useEmulator = resolveUseEmulator({
  USE_FIREBASE_EMULATOR: process.env["USE_FIREBASE_EMULATOR"],
  EXPO_PUBLIC_USE_FIREBASE_EMULATOR: process.env["EXPO_PUBLIC_USE_FIREBASE_EMULATOR"],
});

if (useEmulator) {
  const targets = emulatorTargets({
    FIREBASE_EMULATOR_HOST: process.env["FIREBASE_EMULATOR_HOST"],
    EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: process.env["EXPO_PUBLIC_FIREBASE_EMULATOR_HOST"],
    EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT: process.env["EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT"],
    EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT: process.env["EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT"],
  });
  try {
    connectFirestoreEmulator(db, targets.host, targets.firestorePort);
    connectFunctionsEmulator(functions, targets.host, targets.functionsPort);
  } catch {
    // Already connected
  }
}
