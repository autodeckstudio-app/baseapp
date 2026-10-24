// TEST. Direct tests of the functions-side resolver (not a mirror assumption).
import { describe, it, expect } from "vitest";
import { resolveClaims, DEFAULT_OWNER_EMAIL } from "../../lib/roleResolver.js";

const mk = (entry?: Record<string, unknown>) => {
  const set: Array<Record<string, unknown>> = [];
  const auth = { setCustomUserClaims: async (_u: string, c: Record<string, unknown>) => { set.push(c); } } as never;
  const q: Record<string, unknown> = {};
  q["where"] = () => q; q["limit"] = () => q;
  q["doc"] = () => ({ set: async () => undefined }); q["get"] = async () => ({ empty: !entry, docs: entry ? [{ id: "e1", data: () => entry }] : [] });
  const db = { collection: () => q } as never;
  return { auth, db, set };
};
const tok = (email: string, role = "customer") => ({ uid: "u1", email, email_verified: true, role, tenantId: "t1" });

describe("functions resolveClaims accountant", () => {
  it("active accountant roster entry -> accountant, roster tenant, studioId null", async () => {
    const { auth, db } = mk({ role: "accountant", tenantId: "t9", studioId: "s1", active: true });
    const r = await resolveClaims(auth, db, tok("ca@example.com"));
    expect(r.claims).toEqual({ role: "accountant", tenantId: "t9", studioId: null });
  });
  it("no active entry demotes an accountant token to customer", async () => {
    const { auth, db } = mk();
    expect((await resolveClaims(auth, db, tok("ca@example.com", "accountant"))).claims.role).toBe("customer");
  });
  it("unverified email never gets the accountant role", async () => {
    const { auth, db } = mk({ role: "accountant", tenantId: "t9", active: true });
    expect((await resolveClaims(auth, db, { ...tok("ca@example.com"), email_verified: false })).claims.role).toBe("customer");
  });
  it("owner stays admin, superadmin untouched, studio entry keeps studioId", async () => {
    expect((await resolveClaims(mk().auth, mk().db, tok(DEFAULT_OWNER_EMAIL, "accountant"))).claims.role).toBe("admin");
    const s = mk({ role: "accountant", tenantId: "t9", active: true });
    expect((await resolveClaims(s.auth, s.db, tok("a@b.com", "superadmin"))).claims.role).toBe("superadmin");
    const st = mk({ role: "studio", tenantId: "t1", studioId: "s1", active: true });
    expect((await resolveClaims(st.auth, st.db, tok("s@example.com"))).claims).toEqual({ role: "studio", tenantId: "t1", studioId: "s1" });
  });
});
