"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// In a real production build (`next build`/`next start`, NODE_ENV set by
// Next.js itself — not something this repo needs to configure), silently
// falling back to the dev project ID would mean real admin actions land in
// "autodeck-dev" instead of the actual production Firebase project, with no
// error or warning anywhere — a genuine deploy-safety hole (Phase 6 hostile
// audit finding).
if (process.env.NODE_ENV === "production" && !process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"]) {
  throw new Error(
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set in a production build — refusing to silently fall back to the dev Firebase project.",
  );
}

const firebaseConfig = {
  apiKey: process.env["NEXT_PUBLIC_FIREBASE_API_KEY"] ?? "demo-key",
  authDomain: process.env["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"] ?? "autodeck-dev.firebaseapp.com",
  projectId: process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] ?? "autodeck-dev",
  storageBucket: process.env["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"] ?? "autodeck-dev.firebasestorage.app",
  messagingSenderId: process.env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] ?? "000000000000",
  appId: process.env["NEXT_PUBLIC_FIREBASE_APP_ID"] ?? "1:000000000000:web:demo",
};

const app = getApps()[0] ?? initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-south1");

export const useEmulator = process.env["NEXT_PUBLIC_USE_FIREBASE_EMULATOR"] === "true";

if (useEmulator) {
  const host = process.env["NEXT_PUBLIC_FIREBASE_EMULATOR_HOST"] ?? "localhost";
  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectFunctionsEmulator(functions, host, 5001);
  } catch {
    // Already connected (Next.js fast refresh)
  }
} else {
  void setPersistence(auth, browserLocalPersistence);
}
