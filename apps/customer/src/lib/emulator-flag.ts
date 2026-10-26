/**
 * Single decision point for "talk to the local Firebase emulators".
 *
 * Native dev builds set USE_FIREBASE_EMULATOR=true (Metro inlines it).
 * The static WEB export only inlines EXPO_PUBLIC_* variables, so the web
 * preview/export needs EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true instead.
 * Production builds set neither, and anything other than the literal
 * "true" (including "1" or "yes") keeps the app on the real backend.
 */
export function resolveUseEmulator(env: Record<string, string | undefined>): boolean {
  return env["USE_FIREBASE_EMULATOR"] === "true" || env["EXPO_PUBLIC_USE_FIREBASE_EMULATOR"] === "true";
}

export type EmulatorTargets = {
  host: string;
  firestorePort: number;
  functionsPort: number;
  authUrl: string;
};

/**
 * Host/ports for the local emulator suite. The money-test suite runs
 * Firestore on 8081 (not the CLI default 8080), so the web export gets the
 * port from EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT; native dev keeps the CLI
 * defaults. Auth stays on 9099 in both.
 */
export function emulatorTargets(env: Record<string, string | undefined>): EmulatorTargets {
  const host = env["FIREBASE_EMULATOR_HOST"] ?? env["EXPO_PUBLIC_FIREBASE_EMULATOR_HOST"] ?? "localhost";
  const firestorePort = Number(env["EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT"] ?? "8080");
  const functionsPort = Number(env["EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT"] ?? "5001");
  const authPort = Number(env["EXPO_PUBLIC_AUTH_EMULATOR_PORT"] ?? "9099");
  return { host, firestorePort, functionsPort, authUrl: `http://${host}:${authPort}` };
}

