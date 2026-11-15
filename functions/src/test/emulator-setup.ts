import { initializeApp, cert } from "firebase-admin/app";

// Point Admin SDK at local emulators
process.env["FIRESTORE_EMULATOR_HOST"] ??= "localhost:8099"; // matches firebase.json (firestore.port 8099)
// @firebase/rules-unit-testing files default to port 8080; firebase.json has
// served 8099 for a long time, so the rules suites could never have connected
// on their default. Point their override at the actual port.
process.env["FIRESTORE_EMULATOR_TEST_PORT"] ??= "8099";
process.env["FIREBASE_AUTH_EMULATOR_HOST"] ??= "localhost:9099";
process.env["FIREBASE_STORAGE_EMULATOR_HOST"] ??= "localhost:9199";
// VERIFY/final gates may force a demo-* project id (demo-* can never fall
// back to a live backend); the historical default stays autodeck-dev.
process.env["GCLOUD_PROJECT"] ??= "autodeck-dev";
const PROJECT = process.env["GCLOUD_PROJECT"]!;
export const TEST_PROJECT_ID = PROJECT;

// A throwaway service-account keypair can be injected for tests that mint
// real signed URLs (e.g. storage upload URL flows); without it the app uses
// application default credentials and those specific tests cannot sign.
// storageBucket is named explicitly in both branches so getStorage().bucket()
// resolves in tests the same way the default bucket resolves in production.
const hasSignCred = Boolean(process.env["TEST_SIGN_CLIENT_EMAIL"] && process.env["TEST_SIGN_PRIVATE_KEY"]);

initializeApp(
  hasSignCred
    ? {
        projectId: PROJECT,
        storageBucket: `${PROJECT}.appspot.com`,
        credential: cert({
          projectId: PROJECT,
          clientEmail: process.env["TEST_SIGN_CLIENT_EMAIL"]!,
          privateKey: process.env["TEST_SIGN_PRIVATE_KEY"]!,
        }),
      }
    : { projectId: PROJECT, storageBucket: `${PROJECT}.appspot.com` },
);
