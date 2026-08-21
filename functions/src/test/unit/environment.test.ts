// Unit coverage for functions/src/lib/environment.ts's environment-detection
// helpers. isProductionProject() already has emulator-level coverage in
// production-safety.emulator.test.ts (it gates real production behavior);
// this file adds direct unit coverage for shouldEnforceAppCheck() (Phase 5B
// P1-13), which only depends on FUNCTIONS_EMULATOR and needs no Firestore/
// Auth emulator to exercise.
import { describe, it, expect, afterEach } from "vitest";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

const ORIGINAL_FUNCTIONS_EMULATOR = process.env["FUNCTIONS_EMULATOR"];

afterEach(() => {
  if (ORIGINAL_FUNCTIONS_EMULATOR === undefined) {
    delete process.env["FUNCTIONS_EMULATOR"];
  } else {
    process.env["FUNCTIONS_EMULATOR"] = ORIGINAL_FUNCTIONS_EMULATOR;
  }
});

describe("shouldEnforceAppCheck", () => {
  it("returns false when running under the real Functions emulator (FUNCTIONS_EMULATOR=true)", () => {
    process.env["FUNCTIONS_EMULATOR"] = "true";
    expect(shouldEnforceAppCheck()).toBe(false);
  });

  it("returns true when FUNCTIONS_EMULATOR is unset (a real deployment)", () => {
    delete process.env["FUNCTIONS_EMULATOR"];
    expect(shouldEnforceAppCheck()).toBe(true);
  });

  it("returns true for any FUNCTIONS_EMULATOR value other than the literal string 'true'", () => {
    process.env["FUNCTIONS_EMULATOR"] = "false";
    expect(shouldEnforceAppCheck()).toBe(true);
  });
});
