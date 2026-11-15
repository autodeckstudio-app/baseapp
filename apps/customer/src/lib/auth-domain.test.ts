import { describe, it, expect } from "vitest";
import { resolveAuthDomain } from "./auth-domain";

const CONFIGURED = "autodeck-studio.firebaseapp.com";
describe("resolveAuthDomain", () => {
  it("uses the page host on our own domains", () => {
    expect(resolveAuthDomain(CONFIGURED, "app.autodeck.in")).toBe("app.autodeck.in");
    expect(resolveAuthDomain(CONFIGURED, "studio.autodeck.in")).toBe("studio.autodeck.in");
  });
  it("keeps the configured domain on localhost and unknown hosts", () => {
    expect(resolveAuthDomain(CONFIGURED, "localhost:8081")).toBe(CONFIGURED);
    expect(resolveAuthDomain(CONFIGURED, "evil-autodeck.in")).toBe(CONFIGURED);
    expect(resolveAuthDomain(CONFIGURED, undefined)).toBe(CONFIGURED);
  });
});
