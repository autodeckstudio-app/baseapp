import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { environment } from './environment';

/** See studio-mobile's identical file for the full rationale. */
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
