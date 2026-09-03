import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { environment } from './environment';

/**
 * Singleton Firebase app/Auth instances for React Native. Uses the plain
 * `firebase/auth` (JS SDK) `getAuth`, not `initializeAuth` with a custom
 * persistence layer — Phase 3A's foundation does not depend on session
 * persistence surviving an app restart; `getAuth`'s default in-memory
 * behavior is sufficient here; a persistent-storage layer
 * (`@react-native-async-storage/async-storage` + `getReactNativePersistence`)
 * can be added later without changing this module's public shape.
 *
 * Emulator connection is opt-out (default true), matching the backend's
 * own fail-closed posture — a developer must deliberately set
 * `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=false` to reach anything else, and
 * `projectId` staying a `demo-*` alias means Firebase's own tooling
 * refuses to route to a real project regardless.
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
