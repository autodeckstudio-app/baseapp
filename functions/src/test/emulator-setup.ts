import { initializeApp, cert } from "firebase-admin/app";

// Point Admin SDK at local emulators
process.env["FIRESTORE_EMULATOR_HOST"] ??= "localhost:8080";
process.env["FIREBASE_AUTH_EMULATOR_HOST"] ??= "localhost:9099";
process.env["FIREBASE_STORAGE_EMULATOR_HOST"] ??= "localhost:9199";
process.env["GCLOUD_PROJECT"] = "autodeck-dev";

// A throwaway service-account keypair can be injected for tests that mint
// real signed URLs (e.g. storage upload URL flows); without it the app uses
// application default credentials and those specific tests cannot sign.
// storageBucket is named explicitly in both branches so getStorage().bucket()
// resolves in tests the same way the default bucket resolves in production.
const hasSignCred = Boolean(process.env["TEST_SIGN_CLIENT_EMAIL"] && process.env["TEST_SIGN_PRIVATE_KEY"]);

initializeApp(
  hasSignCred
    ? {
        projectId: "autodeck-dev",
        storageBucket: "autodeck-dev.appspot.com",
        credential: cert({
          projectId: "autodeck-dev",
          clientEmail: process.env["TEST_SIGN_CLIENT_EMAIL"]!,
          privateKey: process.env["TEST_SIGN_PRIVATE_KEY"]!,
        }),
      }
    : { projectId: "autodeck-dev", storageBucket: "autodeck-dev.appspot.com" },
);
