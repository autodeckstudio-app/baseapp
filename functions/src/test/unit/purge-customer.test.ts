import { describe, it, expect } from "vitest";
import { purgeCustomerData, ANONYMISED_NAME } from "../../lib/purge-customer.js";

type Doc = Record<string, unknown>;
function fakeDb(data: Record<string, Record<string, Doc>>) {
  const mkSnap = (col: string, id: string) => ({
    id,
    get exists() { return !!data[col]?.[id]; },
    get: (k: string) => data[col]?.[id]?.[k],
    ref: { delete: async () => { delete data[col]![id]; }, update: async (p: Doc) => { Object.assign(data[col]![id]!, p); } },
  });
  return {
    collection: (col: string) => ({
      doc: (id: string) => ({ get: async () => mkSnap(col, id), delete: async () => { delete data[col]![id]; }, update: async (p: Doc) => { Object.assign(data[col]![id]!, p); } }),
      where: (field: string, _op: string, val: unknown) => ({ get: async () => ({ docs: Object.keys(data[col] ?? {}).filter((id) => data[col]![id]![field] === val).map((id) => mkSnap(col, id)) }) }),
    }),
  } as never;
}

describe("purgeCustomerData", () => {
  const base = () => ({
    customers: { c1: { tenantId: "t", name: "Asha", phone: "+911", email: "a@x.in" }, c2: { tenantId: "t", name: "Ravi", phone: "+912" } },
    notifications: { n1: { userId: "c1", tenantId: "t" }, n2: { userId: "c2", tenantId: "t" } },
    pushTokens: { c1: { tokens: ["x"] } },
    vehicles: { v1: { tenantId: "t", ownerId: "c1", photoUrl: "u", registrationNumber: "GJ01" }, v2: { tenantId: "t", ownerId: "c2", photoUrl: "u" } },
    invoices: { i1: { tenantId: "t", customerId: "c1", total: 5000 } },
    warranties: { w1: { tenantId: "t", customerId: "c1" } },
  }) as Record<string, Record<string, Doc>>;

  it("anonymises the customer, deletes personal items, keeps invoices and warranties, leaves others alone", async () => {
    const d = base();
    const s = await purgeCustomerData(fakeDb(d), "t", "c1", "2026-11-05T00:00:00Z");
    expect(s).toEqual({ notificationsDeleted: 1, pushTokenDeleted: true, vehiclesCleared: 1, customerAnonymised: true });
    expect(d.customers!.c1).toMatchObject({ name: ANONYMISED_NAME, phone: "", email: null });
    expect(d.notifications!.n1).toBeUndefined();
    expect(d.notifications!.n2).toBeDefined();
    expect(d.pushTokens!.c1).toBeUndefined();
    expect(d.vehicles!.v1).toMatchObject({ photoUrl: null, registrationNumber: "GJ01" });
    expect(d.vehicles!.v2!.photoUrl).toBe("u");
    expect(d.invoices!.i1).toEqual({ tenantId: "t", customerId: "c1", total: 5000 });
    expect(d.warranties!.w1).toBeDefined();
    expect(d.customers!.c2).toMatchObject({ name: "Ravi", phone: "+912" });
  });
  it("is idempotent", async () => {
    const d = base();
    await purgeCustomerData(fakeDb(d), "t", "c1", "x");
    const s2 = await purgeCustomerData(fakeDb(d), "t", "c1", "x");
    expect(s2).toMatchObject({ notificationsDeleted: 0, pushTokenDeleted: false, vehiclesCleared: 0 });
  });
  it("does nothing across tenants", async () => {
    const d = base();
    const s = await purgeCustomerData(fakeDb(d), "other", "c1", "x");
    expect(s.customerAnonymised).toBe(false);
    expect(d.customers!.c1!.name).toBe("Asha");
  });
});
