import { describe, expect, it } from "vitest";
import { emulatorConnectionsVerified, emulatorTargets, resolveUseEmulator } from "./emulator-flag";

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
    expect(emulatorTargets({})).toEqual({ host: "localhost", firestorePort: 8080, functionsPort: 5001, storagePort:9199, authUrl: "http://localhost:9099" });
  });
  it("lets the web export reach the money-test Firestore port", () => {
    const t = emulatorTargets({ EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT: "8081" });
    expect(t.firestorePort).toBe(8081);
  });
  it("honours an explicit host override", () => {
    expect(emulatorTargets({ EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: "127.0.0.1" }).authUrl).toBe("http://127.0.0.1:9099");
  });
});

describe("local-test notice wiring", () => {
  const layout = require("node:fs").readFileSync(`${__dirname}/../app/_layout.tsx`, "utf8");
  it("renders only from a foldable direct-env ternary", () => {
    expect(layout).toContain('process.env["EXPO_PUBLIC_USE_FIREBASE_EMULATOR"] === "true"');
    expect(layout).toContain("Local test build. Emulator data; sample content and prices.");
    expect(layout).not.toContain("localTestNotice(");
  });
  it("Metro's minifier does not fold the ternary, so the copy ships inert - runtime checks own activation proof", () => {
    // Documented limitation: the no-flag export still contains the notice string (never rendered).
    // Separation is proven at runtime: no emulator connections, no strip in the DOM.
    expect(layout).toContain(": null;");
  });
});

describe("emulatorConnectionsVerified", () => {
  const env = {
    EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT: "8099",
  };
  const good = {
    firestoreHost: "localhost:8099",
    storageHost:"localhost:9199",
    functionsOrigin: "http://localhost:5001",
    authEmulatorUrl: "http://localhost:9099",
  };
  it("accepts only when every client provably points at the emulator targets", () => {
    expect(emulatorConnectionsVerified(good, env)).toBe(true);
    expect(emulatorConnectionsVerified({...good,authEmulatorUrl:"http://localhost:9099/"},env)).toBe(true);
    expect(emulatorConnectionsVerified({...good,authEmulatorUrl:"http://localhost:9099/other"},env)).toBe(false);
    expect(emulatorConnectionsVerified({...good,storageHost:null},env)).toBe(false);
    expect(emulatorConnectionsVerified({...good,storageHost:"firebasestorage.googleapis.com"},env)).toBe(false);
  });
  it("fails closed when any client missed the connection", () => {
    expect(emulatorConnectionsVerified({ ...good, firestoreHost: null }, env)).toBe(false);
    expect(emulatorConnectionsVerified({ ...good, functionsOrigin: null }, env)).toBe(false);
    expect(emulatorConnectionsVerified({ ...good, authEmulatorUrl: null }, env)).toBe(false);
  });
  it("fails closed when any client points anywhere else", () => {
    expect(emulatorConnectionsVerified({ ...good, firestoreHost: "localhost:8080" }, env)).toBe(false);
    expect(emulatorConnectionsVerified({ ...good, functionsOrigin: "http://localhost:9999" }, env)).toBe(false);
    expect(emulatorConnectionsVerified({ ...good, authEmulatorUrl: "http://127.0.0.1:9099" }, env)).toBe(false);
    expect(emulatorConnectionsVerified(good, {})).toBe(false);
  });
});
