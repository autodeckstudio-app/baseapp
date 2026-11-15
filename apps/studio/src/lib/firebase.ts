import { getApps, initializeApp } from "firebase/app";
import * as fbAuth from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  initializeFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { Platform } from "react-native";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// In a real production (release) build, silently falling back to the dev
// project ID would mean real jobs/payments land in "autodeck-dev" instead
// of the actual production Firebase project, with no error or warning
// anywhere — a genuine deploy-safety hole (Phase 6 hostile audit finding).
// __DEV__ is false in a production RN/Expo bundle regardless of how the
// build was invoked, so this check can't be bypassed by simply forgetting
// to set NODE_ENV.
// Also enforced in development: a missing project id used to fall back to
// "autodeck-dev", so one app could read and write a different database from the
// others and jobs would look unsynced between apps.
if (!process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"]) {
  throw new Error(
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID is not set in a production build; refusing to silently fall back to the dev Firebase project.",
  );
}

const firebaseConfig = {
  apiKey: process.env["EXPO_PUBLIC_FIREBASE_API_KEY"] ?? "demo-key",
  authDomain:
    process.env["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"] ??
    "autodeck-dev.firebaseapp.com",
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

// Browser build has no getReactNativePersistence; use local storage on web.
const rnPersist = (
  fbAuth as unknown as {
    getReactNativePersistence?: (s: unknown) => fbAuth.Persistence;
  }
).getReactNativePersistence;
export const auth = fbAuth.initializeAuth(app, {
  persistence:
    Platform.OS === "web" || !rnPersist
      ? fbAuth.browserLocalPersistence
      : rnPersist(AsyncStorage),
});

export const db = initializeFirestore(
  app,
  Platform.OS === "web" ? { experimentalForceLongPolling: true } : {},
);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-south1");

export const useEmulator =
  process.env["USE_FIREBASE_EMULATOR"] === "true" ||
  process.env["EXPO_PUBLIC_USE_FIREBASE_EMULATOR"] === "true";

if (useEmulator) {
  const host =
    process.env["FIREBASE_EMULATOR_HOST"] ??
    process.env["EXPO_PUBLIC_FIREBASE_EMULATOR_HOST"] ??
    "localhost";
  // Reconnect independently so an already-connected client cannot skip auth/storage.
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
  try {
    fbAuth.connectAuthEmulator(
      auth,
      `http://${host}:${Number(process.env["EXPO_PUBLIC_AUTH_EMULATOR_PORT"] ?? "9099")}`,
      { disableWarnings: true },
    );
  } catch {}
  try {
    connectStorageEmulator(
      storage,
      host,
      Number(process.env["EXPO_PUBLIC_STORAGE_EMULATOR_PORT"] ?? "9199"),
    );
  } catch {}
}
