import { getApps, initializeApp } from "firebase/app";
import { initializeAuth, inMemoryPersistence } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// NOTE: getReactNativePersistence is in the React Native build of @firebase/auth (index.rn.d.ts)
// which requires Metro bundler configuration to resolve properly.
// For Phase 1a (emulator development), inMemoryPersistence is used — auth token stays in memory
// for the session. For production, configure Metro to resolve firebase/auth to the RN build,
// or migrate to @react-native-firebase/auth (requires Expo custom dev build).

const firebaseConfig = {
  apiKey: process.env["EXPO_PUBLIC_FIREBASE_API_KEY"] ?? "demo-key",
  authDomain:
    process.env["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"] ?? "autodeck-dev.firebaseapp.com",
  projectId: process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"] ?? "autodeck-dev",
  storageBucket:
    process.env["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"] ?? "autodeck-dev.firebasestorage.app",
  messagingSenderId:
    process.env["EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] ?? "000000000000",
  appId: process.env["EXPO_PUBLIC_FIREBASE_APP_ID"] ?? "1:000000000000:web:demo",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;

export const auth = initializeAuth(app, {
  persistence: inMemoryPersistence,
});

export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-south1");

export const useEmulator = process.env["USE_FIREBASE_EMULATOR"] === "true";

if (useEmulator) {
  const host = process.env["FIREBASE_EMULATOR_HOST"] ?? "localhost";
  try {
    connectFirestoreEmulator(db, host, 8080);
    connectFunctionsEmulator(functions, host, 5001);
  } catch {
    // Already connected (React Native fast refresh)
  }
}
