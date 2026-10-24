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

import { resolveAndSyncClaims } from "./role-resolver";
import { parseAddStaff, parseRoleChange } from "./staff-admin";
describe("accountant roster role", () => {
  const mk = (entry?: Record<string, unknown>) => {
    const set: Array<Record<string, unknown>> = [];
    const auth = { setCustomUserClaims: async (_u: string, c: Record<string, unknown>) => { set.push(c); } } as never;
    const db = { collection: () => ({
      where: () => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: entry ? [{ id: "e1", data: () => entry }] : [] }) }) }) }),
      doc: () => ({ set: async () => undefined }) }) } as never;
    return { auth, db, set };
  };
  const tok = (email: string, role = "customer") => ({ uid: "u1", email, email_verified: true, role, tenantId: "t1", studioId: null }) as never;
  it("an ACTIVE accountant roster entry gives accountant, roster tenant, studioId null (a studioId on the doc is ignored)", async () => {
    const { auth, db, set } = mk({ role: "accountant", tenantId: "t9", studioId: "s1", active: true });
    const r = await resolveAndSyncClaims(auth, db, tok("ca@example.com"));
    expect(r).toEqual({ claims: { role: "accountant", tenantId: "t9", studioId: null }, changed: true });
    expect(set[0]).toEqual({ role: "accountant", tenantId: "t9", studioId: null });
  });
  it("no roster entry (missing or inactive: the query only returns active ones) demotes an accountant token to customer", async () => {
    const { auth, db, set } = mk();
    const r = await resolveAndSyncClaims(auth, db, tok("ca@example.com", "accountant"));
    expect(r.claims.role).toBe("customer");
    expect(set).toHaveLength(1);
  });
  it("owner email stays admin and a customer without roster is never promoted", async () => {
    expect((await resolveAndSyncClaims(mk().auth, mk().db, tok(DEFAULT_OWNER_EMAIL, "accountant"))).claims.role).toBe("admin");
    expect((await resolveAndSyncClaims(mk().auth, mk().db, tok("x@example.com"))).claims.role).toBe("customer");
  });
  it("superadmin tokens are untouched", async () => {
    const { auth, db, set } = mk({ role: "accountant", tenantId: "t9", active: true });
    expect((await resolveAndSyncClaims(auth, db, tok("a@b.com", "superadmin"))).claims.role).toBe("superadmin");
    expect(set).toHaveLength(0);
  });
  it("admin and studio roster entries are unchanged (admin studioId null, studio keeps studio)", async () => {
    expect((await resolveAndSyncClaims(mk({ role: "studio", tenantId: "t1", studioId: "s1", active: true }).auth, mk({ role: "studio", tenantId: "t1", studioId: "s1", active: true }).db, tok("s@example.com"))).claims).toEqual({ role: "studio", tenantId: "t1", studioId: "s1" });
    expect(claimsFor("m@example.com", { id: "e", role: "admin", studioId: "x", tenantId: "t1" }).studioId).toBeNull();
  });
  it("no staff input path accepts 'accountant' (add and role change both reject it)", () => {
    expect(() => parseAddStaff({ name: "Nina Rao", email: "n@example.com", phone: "", role: "accountant", studioId: null })).toThrow();
    expect(() => parseRoleChange({ employeeId: "e1", role: "accountant", studioId: null })).toThrow();
  });
});
