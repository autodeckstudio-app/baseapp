import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

describe("firebase-admin credential loading", () => {
  it("does not require runtime credentials when the module is imported during a build", async () => {
    delete process.env["FIREBASE_SERVICE_ACCOUNT_KEY"];
    delete process.env["FIREBASE_AUTH_EMULATOR_HOST"];
    delete process.env["K_SERVICE"];

    const module = await import("./firebase-admin");

    expect(module.getAdminAuth).toBeTypeOf("function");
  });

  it("still fails clearly when a non-GCP runtime first asks for Admin Auth without credentials", async () => {
    delete process.env["FIREBASE_SERVICE_ACCOUNT_KEY"];
    delete process.env["FIREBASE_AUTH_EMULATOR_HOST"];
    delete process.env["K_SERVICE"];

    const { getAdminAuth } = await import("./firebase-admin");

    expect(() => getAdminAuth()).toThrow(
      /FIREBASE_SERVICE_ACCOUNT_KEY is not set/,
    );
  });
});
