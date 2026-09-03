'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { environment } from './environment';

/**
 * Singleton Firebase app/Auth instances. `getApps()`/`getApp()` guards
 * against Next.js's hot-reload re-executing this module and calling
 * `initializeApp` twice, which Firebase itself throws on.
 *
 * Emulator connection is opt-out (`useAuthEmulator`, default true) rather
 * than opt-in — the safe default is always the emulator, matching the
 * backend's own fail-closed posture; a developer must deliberately flip
 * `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false` to reach anything else, and
 * even then `projectId` staying a `demo-*` alias means Firebase's own
 * tooling refuses to route to a real project regardless.
 */
function createFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(environment.firebase);
}

let cachedAuth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (cachedAuth) {
    return cachedAuth;
  }
  const auth = getAuth(createFirebaseApp());
  if (environment.useAuthEmulator) {
    connectAuthEmulator(auth, `http://${environment.authEmulatorHost}`, { disableWarnings: true });
  }
  cachedAuth = auth;
  return cachedAuth;
}
