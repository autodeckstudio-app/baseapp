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
