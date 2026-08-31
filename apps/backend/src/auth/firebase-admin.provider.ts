import * as admin from 'firebase-admin';

export const FIREBASE_ADMIN_APP = Symbol('FIREBASE_ADMIN_APP');

export interface EmulatorFirebaseConfig {
  projectId: string;
  firestoreEmulatorHost: string;
  authEmulatorHost: string;
}

/**
 * Creates the Firebase Admin app for Phase 1.
 *
 * FAILS CLOSED: refuses to start at all — rather than silently falling back
 * to a real Firebase project — if the project ID isn't a `demo-*` alias or
 * either emulator host is missing. No service-account credential is ever
 * supplied here, and none is required for emulator use.
 */
export function createFirebaseAdminApp(config: EmulatorFirebaseConfig): admin.app.App {
  const { projectId, firestoreEmulatorHost, authEmulatorHost } = config;

  if (!projectId.startsWith('demo-')) {
    throw new Error(
      `Refusing to start: FIREBASE_PROJECT_ID ("${projectId}") is not a demo-* project. ` +
        'Phase 1 must never connect to a real Firebase project.',
    );
  }
  if (!firestoreEmulatorHost || !authEmulatorHost) {
    throw new Error(
      'Refusing to start: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must both be set. ' +
        'Failing closed rather than falling back to a real Firebase project.',
    );
  }

  // Setting these env vars is what redirects the Admin SDK away from real
  // Firebase and toward the local emulators — this is the actual mechanism,
  // not just documentation of intent.
  process.env.FIRESTORE_EMULATOR_HOST = firestoreEmulatorHost;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = authEmulatorHost;

  if (admin.apps.length > 0) {
    return admin.app();
  }

  return admin.initializeApp({ projectId });
}
