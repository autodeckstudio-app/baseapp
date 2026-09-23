// Web build of the Firebase client (Metro picks *.web.ts for web). Same
// project and safety check as the native build; the session persists in the
// browser instead of AsyncStorage.
import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, initializeAuth, browserPopupRedirectResolver } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

if (!__DEV__ && !process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"]) {
  throw new Error(
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID is not set in a production build — refusing to silently fall back to the dev Firebase project.",
  );
}

const firebaseConfig = {
  apiKey: process.env["EXPO_PUBLIC_FIREBASE_API_KEY"] ?? "demo-key",
  authDomain: process.env["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"] ?? "autodeck-dev.firebaseapp.com",
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
export const useEmulator = false;
