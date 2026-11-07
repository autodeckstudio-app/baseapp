/* Pins the resolver contract the self-service writers rely on: `?? uid` may
 * ONLY engage on a verified-absent profile (both lookups completed, nothing
 * found). Error, corruption, and ambiguity must throw - never a uid-stamp. */
import { describe, expect, it } from "vitest";
import { resolveCustomerDocId } from "../../lib/customer-identity.js";

type Row = { authUid?: string; tenantId?: string; deletedAt?: string | null };
const fakeDb = (rows: Record<string, Row>, failOn?: "direct" | "query") => ({
  collection: (_name: string) => ({
    doc: (id: string) => ({
      get: async () => {
        if (failOn === "direct") throw new Error("transient firestore outage");
        return { exists: id in rows, data: () => rows[id] };
      },
    }),
    where: (field: string, _op: string, value: unknown) => ({
      limit: (_n: number) => ({
        get: async () => {
          if (failOn === "query") throw new Error("transient firestore outage");
          return {
            docs: Object.entries(rows)
              .filter(([, d]) => (d as Record<string, unknown>)[field] === value)
              .map(([id, d]) => ({ id, data: () => d })),
          };
        },
      }),
    }),
  }),
});

describe("resolveCustomerDocId null semantics (write-fallback contract)", () => {
  it("returns null only when BOTH lookups complete and find nothing (verified absent)", async () => {
    await expect(resolveCustomerDocId(fakeDb({}) as any, "customers", "t", "u1")).resolves.toBeNull();
  });
  it("resolves a legacy doc (id == uid) bound to the principal", async () => {
    await expect(resolveCustomerDocId(fakeDb({ u1: { authUid: "u1", tenantId: "t" } }) as any, "customers", "t", "u1")).resolves.toBe("u1");
  });
  it("resolves a claimed staged doc (doc id != uid) via the authUid binding", async () => {
    await expect(resolveCustomerDocId(fakeDb({ "cust-staged": { authUid: "u1", tenantId: "t" } }) as any, "customers", "t", "u1")).resolves.toBe("cust-staged");
  });
  it("fails closed on a corrupt direct doc bound to a different principal", async () => {
    await expect(resolveCustomerDocId(fakeDb({ u1: { authUid: "someone-else", tenantId: "t" } }) as any, "customers", "t", "u1")).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("fails closed on ambiguous bindings (two live authUid docs)", async () => {
    const rows = { a: { authUid: "u1", tenantId: "t" }, b: { authUid: "u1", tenantId: "t" } };
    await expect(resolveCustomerDocId(fakeDb(rows) as any, "customers", "t", "u1")).rejects.toMatchObject({ code: "internal" });
  });
  it("propagates transient read failures as errors - never null, never a uid fallback", async () => {
    await expect(resolveCustomerDocId(fakeDb({}, "direct") as any, "customers", "t", "u1")).rejects.toThrow("transient firestore outage");
    await expect(resolveCustomerDocId(fakeDb({}, "query") as any, "customers", "t", "u1")).rejects.toThrow("transient firestore outage");
  });
  it("ignores deleted and cross-tenant bindings when resolving a claimed doc", async () => {
    const rows = { gone: { authUid: "u1", tenantId: "t", deletedAt: "2026-01-01" }, other: { authUid: "u1", tenantId: "t2" } };
    await expect(resolveCustomerDocId(fakeDb(rows) as any, "customers", "t", "u1")).resolves.toBeNull();
  });
});
