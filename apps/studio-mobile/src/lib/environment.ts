/**
 * Development/local environment configuration. Every value here is either
 * an obviously-fake placeholder safe for the Firebase Auth EMULATOR only,
 * or read from an `EXPO_PUBLIC_*` environment variable (Expo's own
 * mechanism, since SDK 49, for exposing a value to app code — nothing
 * secret belongs behind that prefix) — never a committed real credential.
 *
 * `projectId` must stay a `demo-*` alias, matching the backend's own
 * fail-closed emulator-only rule.
 *
 * A physical device/simulator cannot reach the backend via `localhost` —
 * it needs the DEVELOPMENT MACHINE'S OWN LAN IP. `apiBaseUrl` is left
 * fully overridable via env var for exactly that reason; `localhost` is
 * only a safe default for the iOS Simulator or Android emulator's special
 * loopback mapping, not a real device.
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
