import { initializeApp } from "firebase-admin/app";

// Point Admin SDK at local emulators
process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8080";
process.env["FIREBASE_AUTH_EMULATOR_HOST"] = "localhost:9099";
process.env["FIREBASE_STORAGE_EMULATOR_HOST"] = "localhost:9199";
process.env["GCLOUD_PROJECT"] = "autodeck-dev";

initializeApp({ projectId: "autodeck-dev" });
