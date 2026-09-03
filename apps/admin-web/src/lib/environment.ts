/**
 * Development/local environment configuration. Every value here is either
 * an obviously-fake placeholder safe for the Firebase Auth EMULATOR only,
 * or read from a `NEXT_PUBLIC_*` environment variable the developer sets
 * locally (see `.env.local.example`) — never a committed real credential.
 * `NEXT_PUBLIC_*` is Next.js's own mechanism for exposing a value to
 * browser code; nothing secret belongs behind that prefix, which is
 * exactly why these are safe to default even when unset.
 *
 * `projectId` must stay a `demo-*` alias, matching the backend's own
 * fail-closed emulator-only rule (`apps/backend/src/auth/firebase-admin
 * .provider.ts`) — Firebase's own tooling refuses to let a `demo-*`
 * project ID connect to anything real, so this is safe by construction,
 * not merely by convention.
 */
export const environment = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-autodeck.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-autodeck',
  },
  authEmulatorHost: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099',
  useAuthEmulator: (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR ?? 'true') === 'true',
} as const;
