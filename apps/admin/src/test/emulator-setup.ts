// Mirrors functions/src/test/emulator-setup.ts. Points this app's own
// Admin SDK instance (src/lib/firebase-admin.ts) at the local emulators
// before any test imports it.
process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8080";
process.env["FIREBASE_AUTH_EMULATOR_HOST"] = "localhost:9099";
process.env["GCLOUD_PROJECT"] = "autodeck-dev";
