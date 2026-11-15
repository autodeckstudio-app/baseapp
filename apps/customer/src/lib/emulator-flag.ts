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
  storagePort: number;
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
  return { host, firestorePort, functionsPort, storagePort:Number(env["EXPO_PUBLIC_STORAGE_EMULATOR_PORT"]??"9199"), authUrl: `http://${host}:${authPort}` };
}


/**
 * Evidence that the live SDK clients really talk to the local emulators,
 * collected from the connected clients after the connect*Emulator calls.
 */
export type EmulatorConnectionProof = {
  firestoreHost: string | null;
  storageHost:string|null;
  functionsOrigin: string | null;
  authEmulatorUrl: string | null;
};

/**
 * Fail-closed verification of the emulator connection. Never trust the
 * catch: a swallowed "already connected" throw can hide a missed
 * connection, so verify below instead - every client must point at exactly
 * the emulatorTargets for this env, otherwise the backend is NOT proven to
 * be the emulator and this returns false.
 */
export function emulatorConnectionsVerified(
  proof: EmulatorConnectionProof,
  env: Record<string, string | undefined>,
): boolean {
  const t = emulatorTargets(env);
  return (
    proof.storageHost === `${t.host}:${t.storagePort}` &&
    proof.firestoreHost === `${t.host}:${t.firestorePort}` &&
    proof.functionsOrigin === `http://${t.host}:${t.functionsPort}` &&
    (proof.authEmulatorUrl === t.authUrl || proof.authEmulatorUrl === `${t.authUrl}/`)
  );
}
