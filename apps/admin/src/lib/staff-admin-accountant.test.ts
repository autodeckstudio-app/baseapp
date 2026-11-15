// TEST. Admin API mirror: accountant roster entries are owner/superadmin only for role change and deactivate. Fake db/auth.
import { describe, it, expect } from "vitest";
import { changeRole, deactivate } from "./staff-admin";
import { DEFAULT_OWNER_EMAIL } from "./role-resolver";

function world() {
  const writes: unknown[] = [];
  const claimCalls: unknown[] = [];
  const entry = { id: "acc1", tenantId: "t1", studioId: null, authUid: "ca-uid", email: "ca@example.com", role: "accountant", active: true, terminatedAt: null };
  const db = {
    collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => entry }), update: () => writes.push("u") }) }),
    runTransaction: async (fn: (tx: unknown) => Promise<void>) => { writes.push("tx"); await fn({ update: () => writes.push("u"), set: () => writes.push("s") }); },
  } as never;
  const auth = { setCustomUserClaims: async (...a: unknown[]) => { claimCalls.push(a); }, revokeRefreshTokens: async () => undefined } as never;
  return { db, auth, writes, claimCalls };
}
const user = (role: string, email: string) => ({ uid: "x", email, claims: { role, tenantId: "t1", studioId: null } }) as never;

describe("admin API accountant boundary", () => {
  for (const [name, call] of [
    ["changeRole", (w: ReturnType<typeof world>, u: never) => changeRole(w.auth, w.db, u, { employeeId: "acc1", role: "admin", studioId: null })],
    ["deactivate", (w: ReturnType<typeof world>, u: never) => deactivate(w.auth, w.db, u, "acc1")],
  ] as const) {
    it(`${name}: ordinary admin denied, nothing written, no claims touched`, async () => {
      const w = world();
      await expect(call(w, user("admin", "boss2@example.com"))).rejects.toMatchObject({ status: 403 });
      expect(w.writes).toEqual([]);
      expect(w.claimCalls).toEqual([]);
    });
    it(`${name}: owner and superadmin proceed`, async () => {
      for (const u of [user("admin", DEFAULT_OWNER_EMAIL), user("superadmin", "ops@example.com")]) {
        const w = world();
        await call(w, u);
        expect(w.writes.length).toBeGreaterThan(0);
      }
    });
  }
});
