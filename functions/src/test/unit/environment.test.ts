// Unit coverage for functions/src/lib/environment.ts's environment-detection
// helpers. isProductionProject() already has emulator-level coverage in
// production-safety.emulator.test.ts (it gates real production behavior);
// this file adds direct unit coverage for shouldEnforceAppCheck() (Phase 5B
// P1-13 / Phase 5C Batch 1), which only depends on FUNCTIONS_EMULATOR and
// GCLOUD_PROJECT and needs no Firestore/Auth emulator to exercise.
import { describe, it, expect, afterEach } from "vitest";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

const ORIGINAL_FUNCTIONS_EMULATOR = process.env["FUNCTIONS_EMULATOR"];
const ORIGINAL_GCLOUD_PROJECT = process.env["GCLOUD_PROJECT"];

afterEach(() => {
  if (ORIGINAL_FUNCTIONS_EMULATOR === undefined) {
    delete process.env["FUNCTIONS_EMULATOR"];
  } else {
    process.env["FUNCTIONS_EMULATOR"] = ORIGINAL_FUNCTIONS_EMULATOR;
  }
  if (ORIGINAL_GCLOUD_PROJECT === undefined) {
    delete process.env["GCLOUD_PROJECT"];
  } else {
    process.env["GCLOUD_PROJECT"] = ORIGINAL_GCLOUD_PROJECT;
  }
});

describe("shouldEnforceAppCheck", () => {
  it("returns false when running under the real Functions emulator (FUNCTIONS_EMULATOR=true, non-prod project)", () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-dev";
    process.env["FUNCTIONS_EMULATOR"] = "true";
    expect(shouldEnforceAppCheck()).toBe(false);
  });

  it("returns true when FUNCTIONS_EMULATOR is unset (a real non-prod deployment)", () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-dev";
    delete process.env["FUNCTIONS_EMULATOR"];
    expect(shouldEnforceAppCheck()).toBe(true);
  });

  it("returns true for any FUNCTIONS_EMULATOR value other than the literal string 'true'", () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-dev";
    process.env["FUNCTIONS_EMULATOR"] = "false";
    expect(shouldEnforceAppCheck()).toBe(true);
  });

  // Phase 5C Batch 1: the exact production misconfiguration this guard
  // exists to prevent. FUNCTIONS_EMULATOR is not runtime-injected the way
  // GCLOUD_PROJECT is — Cloud Functions Gen2 supports deploy-time env files,
  // so it is not structurally impossible for FUNCTIONS_EMULATOR=true to end
  // up in the real "autodeck-prod" project's own deploy config by mistake.
  // A single misconfigured env var must never be sufficient, on its own, to
  // silently disable App Check in production.
  it("returns true in autodeck-prod even if FUNCTIONS_EMULATOR=true is (mis)configured", () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-prod";
    process.env["FUNCTIONS_EMULATOR"] = "true";
    expect(shouldEnforceAppCheck()).toBe(true);
  });

  it("returns true in autodeck-prod under normal (FUNCTIONS_EMULATOR unset) conditions too", () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-prod";
    delete process.env["FUNCTIONS_EMULATOR"];
    expect(shouldEnforceAppCheck()).toBe(true);
  });
});
