import { describe, expect, it } from "vitest";
import { resolveUseEmulator } from "./emulator-flag";

// The emulator flag decides whether the app talks to local emulators or the
// real backend. A production build sets neither variable, so the default
// must be off; only the literal "true" on either recognised variable may
// turn it on (the web export can only see EXPO_PUBLIC_* variables).
describe("resolveUseEmulator", () => {
  it("is off in a production build (neither variable set)", () => {
    expect(resolveUseEmulator({})).toBe(false);
  });
  it("honours the native dev variable", () => {
    expect(resolveUseEmulator({ USE_FIREBASE_EMULATOR: "true" })).toBe(true);
  });
  it("honours the EXPO_PUBLIC_ variable the web export inlines", () => {
    expect(resolveUseEmulator({ EXPO_PUBLIC_USE_FIREBASE_EMULATOR: "true" })).toBe(true);
  });
  it("rejects truthy-but-not-literal values", () => {
    expect(resolveUseEmulator({ USE_FIREBASE_EMULATOR: "1" })).toBe(false);
    expect(resolveUseEmulator({ EXPO_PUBLIC_USE_FIREBASE_EMULATOR: "yes" })).toBe(false);
    expect(resolveUseEmulator({ EXPO_PUBLIC_USE_FIREBASE_EMULATOR: "True" })).toBe(false);
  });
});
