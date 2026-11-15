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
  const ORIGINAL_FLAG = process.env["APP_CHECK_ENFORCE"];
  afterEach(() => {
    if (ORIGINAL_FLAG === undefined) delete process.env["APP_CHECK_ENFORCE"];
    else process.env["APP_CHECK_ENFORCE"] = ORIGINAL_FLAG;
  });

  it("is off by default, in every project", () => {
    delete process.env["APP_CHECK_ENFORCE"];
    delete process.env["FUNCTIONS_EMULATOR"];
    for (const project of ["autodeck-dev", "autodeck-prod", "autodeck-studio"]) {
      process.env["GCLOUD_PROJECT"] = project;
      expect(shouldEnforceAppCheck()).toBe(false);
    }
  });

  it("turns on only with APP_CHECK_ENFORCE=true", () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-studio";
    delete process.env["FUNCTIONS_EMULATOR"];
    process.env["APP_CHECK_ENFORCE"] = "true";
    expect(shouldEnforceAppCheck()).toBe(true);
    process.env["APP_CHECK_ENFORCE"] = "1";
    expect(shouldEnforceAppCheck()).toBe(false);
  });

  it("never enforces under the Functions emulator", () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-dev";
    process.env["FUNCTIONS_EMULATOR"] = "true";
    process.env["APP_CHECK_ENFORCE"] = "true";
    expect(shouldEnforceAppCheck()).toBe(false);
  });
});
