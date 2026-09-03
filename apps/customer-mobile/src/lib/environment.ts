/**
 * Development/local environment configuration. See studio-mobile's
 * identical file for the full rationale — every value here is either an
 * obviously-fake placeholder safe for the Firebase Auth EMULATOR only, or
 * an `EXPO_PUBLIC_*` override, never a committed real credential.
 */
export const environment = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-autodeck.firebaseapp.com',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-autodeck',
  },
  authEmulatorHost: process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099',
  useAuthEmulator: (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR ?? 'true') === 'true',
} as const;
