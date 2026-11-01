// Environment for the live-emulator screen proof. Runs before any app module loads:
// lib/firebase reads these at module scope to connect the REAL client SDKs to the
// LOCAL emulator suite (never a live backend - the readback check in lib/firebase
// fails closed otherwise).
process.env["USE_FIREBASE_EMULATOR"] = "true";
process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"] = "autodeck-dev";
process.env["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"] = "autodeck-dev.appspot.com";
process.env["EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT"] = process.env["LIVE_FIRESTORE_PORT"] ?? "8099";
process.env["EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT"] = "5001";
process.env["EXPO_PUBLIC_AUTH_EMULATOR_PORT"] = "9099";
// Admin SDK (test seeding only): bypasses rules to plant the vehicle the customer owns.
process.env["FIRESTORE_EMULATOR_HOST"] = `localhost:${process.env["EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT"]}`;
process.env["FIREBASE_AUTH_EMULATOR_HOST"] = "localhost:9099";
process.env["GCLOUD_PROJECT"] = "autodeck-dev";
// Throwaway local-only signing identity for admin createCustomToken (never a real principal).
process.env["TEST_SIGN_CLIENT_EMAIL"] ??= "throwaway@autodeck-dev.iam.gserviceaccount.com";
process.env["TEST_SIGN_PRIVATE_KEY_PATH"] ??= "/tmp/throwaway-key.pem";
