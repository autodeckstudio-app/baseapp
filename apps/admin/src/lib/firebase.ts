"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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

// Phase 5B P1-13: admin is the highest-privilege client — every admin-only
// Cloud Function callable now enforces Firebase App Check server-side (see
// functions/src/lib/environment.ts's shouldEnforceAppCheck()). A production
// build with no reCAPTCHA site key configured would silently ship an admin
// app that can never successfully call any admin-only callable — same
// deploy-safety class as the project-id guard above, so it fails the same
// way: loudly, at boot, instead of as a confusing runtime App Check error.
if (process.env.NODE_ENV === "production" && !process.env["NEXT_PUBLIC_RECAPTCHA_SITE_KEY"]) {
  throw new Error(
    "NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set in a production build — every admin-only Cloud Function enforces App Check, so this build could never successfully call one.",
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

// App Check must be initialized in the browser only — ReCaptchaV3Provider
// touches `window`/`document` directly and this "use client" module can
// still be evaluated once on the server during SSR. Skipped entirely under
// the emulator: the Cloud Functions emulator has a known bug where it
// cannot itself verify App Check tokens, so shouldEnforceAppCheck() already
// disables server-side enforcement whenever FUNCTIONS_EMULATOR=true —
// initializing App Check here too would just add a real network call to
// Google's reCAPTCHA service for no benefit and require a site key for pure
// local/emulator development.
if (typeof window !== "undefined" && !useEmulator) {
  const siteKey = process.env["NEXT_PUBLIC_RECAPTCHA_SITE_KEY"];
  if (siteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  // else: a production build already threw above. A non-production,
  // non-emulator run with no site key (e.g. `next dev` pointed at a real
  // deployed project) is left uninitialized on purpose — admin callables
  // will fail loudly with a genuine App Check error returned by the
  // server, rather than this file silently pretending to be protected.
}
