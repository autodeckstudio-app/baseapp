import { describe, it, expect } from "vitest";
import {
  requireRole,
  requireSameTenant,
  requireSameStudio,
  requireOwnership,
} from "@autodeck/auth";
import type { AuthorizedUser } from "@autodeck/auth";

function makeUser(overrides: Partial<AuthorizedUser> = {}): AuthorizedUser {
  return {
    uid: "uid-customer-a",
    phone: "+919876543210",
    email: null,
    claims: {
      role: "customer",
      tenantId: "automodz",
      studioId: null,
    },
    ...overrides,
  };
}

describe("requireRole", () => {
  it("allows matching role", () => {
    const user = makeUser();
    expect(requireRole(user, "customer").allowed).toBe(true);
  });

  it("allows when one of multiple allowed roles matches", () => {
    const user = makeUser({ claims: { role: "studio", tenantId: "automodz", studioId: "s1" } });
    expect(requireRole(user, "customer", "studio").allowed).toBe(true);
  });

  it("denies wrong role", () => {
    const user = makeUser();
    const result = requireRole(user, "admin");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("customer");
    }
  });
});

describe("requireSameTenant", () => {
  it("allows matching tenant", () => {
    const user = makeUser();
    expect(requireSameTenant(user, "automodz").allowed).toBe(true);
  });

  it("denies mismatched tenant", () => {
    const user = makeUser();
    const result = requireSameTenant(user, "other-tenant");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("Tenant mismatch");
    }
  });

  it("superadmin bypasses tenant check", () => {
    const user = makeUser({
      claims: { role: "superadmin", tenantId: "platform", studioId: null },
    });
    expect(requireSameTenant(user, "any-tenant").allowed).toBe(true);
  });
});

describe("requireSameStudio", () => {
  it("allows studio user on their own studio", () => {
    const user = makeUser({
      claims: { role: "studio", tenantId: "automodz", studioId: "studio-ahmedabad" },
    });
    expect(requireSameStudio(user, "studio-ahmedabad").allowed).toBe(true);
  });

  it("denies studio user on a different studio", () => {
    const user = makeUser({
      claims: { role: "studio", tenantId: "automodz", studioId: "studio-ahmedabad" },
    });
    const result = requireSameStudio(user, "studio-surat");
    expect(result.allowed).toBe(false);
  });

  it("admin bypasses studio check", () => {
    const user = makeUser({ claims: { role: "admin", tenantId: "automodz", studioId: null } });
    expect(requireSameStudio(user, "any-studio").allowed).toBe(true);
  });

  it("superadmin bypasses studio check", () => {
    const user = makeUser({
      claims: { role: "superadmin", tenantId: "platform", studioId: null },
    });
    expect(requireSameStudio(user, "any-studio").allowed).toBe(true);
  });
});

describe("requireOwnership", () => {
  it("allows owner", () => {
    const user = makeUser({ uid: "uid-alice" });
    expect(requireOwnership(user, "uid-alice").allowed).toBe(true);
  });

  it("denies non-owner", () => {
    const user = makeUser({ uid: "uid-alice" });
    const result = requireOwnership(user, "uid-bob");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("not the owner");
    }
  });

  it("admin bypasses ownership check", () => {
    const user = makeUser({ uid: "uid-admin", claims: { role: "admin", tenantId: "automodz", studioId: null } });
    expect(requireOwnership(user, "uid-anyone").allowed).toBe(true);
  });
});
