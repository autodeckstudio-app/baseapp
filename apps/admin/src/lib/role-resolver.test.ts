import { describe, expect, it } from "vitest";
import { claimsFor, sameClaims, verifiedEmail, DEFAULT_OWNER_EMAIL } from "./role-resolver";

describe("verifiedEmail", () => {
  it("rejects unverified addresses", () => {
    expect(verifiedEmail({ email: "a@b.com", email_verified: false })).toBeNull();
    expect(verifiedEmail({ email: "a@b.com" } as never)).toBeNull();
  });
  it("normalises verified addresses", () => {
    expect(verifiedEmail({ email: " A@B.com ", email_verified: true })).toBe("a@b.com");
  });
});

describe("claimsFor", () => {
  it("makes the owner an admin", () => {
    expect(claimsFor(DEFAULT_OWNER_EMAIL, null).role).toBe("admin");
  });
  it("gives active roster staff their roster role", () => {
    const c = claimsFor("tech@gmail.com", { id: "e1", role: "studio", studioId: "studio-ahmedabad", tenantId: "t1" });
    expect(c).toEqual({ role: "studio", tenantId: "t1", studioId: "studio-ahmedabad" });
  });
  it("does not studio-scope roster admins", () => {
    expect(claimsFor("m@gmail.com", { id: "e2", role: "admin", studioId: "x", tenantId: "t1" }).studioId).toBeNull();
  });
  it("defaults everyone else to customer", () => {
    expect(claimsFor("someone@gmail.com", null).role).toBe("customer");
    expect(claimsFor(null, null).role).toBe("customer");
  });
});

describe("sameClaims", () => {
  it("detects demotion", () => {
    expect(sameClaims({ role: "studio", tenantId: "t", studioId: "s" }, { role: "customer", tenantId: "t", studioId: null })).toBe(false);
  });
  it("treats missing studioId as null", () => {
    expect(sameClaims({ role: "admin", tenantId: "t" }, { role: "admin", tenantId: "t", studioId: null })).toBe(true);
  });
});
