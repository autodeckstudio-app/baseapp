import { describe, expect, it } from "vitest";
import { emulatorTargets, localTestNotice, resolveUseEmulator } from "./emulator-flag";

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

describe("emulatorTargets", () => {
  it("defaults to the Firebase CLI ports on localhost", () => {
    expect(emulatorTargets({})).toEqual({ host: "localhost", firestorePort: 8080, functionsPort: 5001, authUrl: "http://localhost:9099" });
  });
  it("lets the web export reach the money-test Firestore port", () => {
    const t = emulatorTargets({ EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT: "8081" });
    expect(t.firestorePort).toBe(8081);
  });
  it("honours an explicit host override", () => {
    expect(emulatorTargets({ EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: "127.0.0.1" }).authUrl).toBe("http://127.0.0.1:9099");
  });
});

describe("localTestNotice", () => {
  it("returns the provenance strip for emulator builds", () => {
    expect(localTestNotice(true)).toBe("Local test build. Emulator data; sample content and prices.");
  });
  it("returns nothing for production builds", () => {
    expect(localTestNotice(false)).toBeNull();
    expect(localTestNotice(resolveUseEmulator({}))).toBeNull();
    expect(localTestNotice(resolveUseEmulator({ EXPO_PUBLIC_USE_FIREBASE_EMULATOR: "true" }))).not.toBeNull();
  });
});
