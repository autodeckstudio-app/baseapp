import { describe, it, expect } from "vitest";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { claimIsHeldByOther, plateClaimId, releaseClaim, writeClaim } from "../../lib/plateClaim.js";

type Store = Record<string, Record<string, unknown>>;

function fake(store: Store) {
  const writes: Array<{ path: string; data: unknown }> = [];
  const db = {
    collection: (c: string) => ({ doc: (id: string) => ({ path: `${c}/${id}` }) }),
  } as unknown as Firestore;
  const tx = {
    get: async (ref: { path: string }) => ({ exists: ref.path in store, data: () => store[ref.path] }),
    set: (ref: { path: string }, data: unknown) => { writes.push({ path: ref.path, data }); },
  } as unknown as Transaction;
  return { db, tx, writes };
}

const T = "t1";
const O = "o1";
const P = "MH12AB1234";
const claimPath = `vehiclePlateClaims/${plateClaimId(T, O, P)}`;

describe("plate claims", () => {
  it("no claim means no conflict", async () => {
    const { db, tx } = fake({});
    expect(await claimIsHeldByOther(db, tx, T, O, P, null)).toBe(false);
  });
  it("a live car holding the claim blocks a second create", async () => {
    const { db, tx } = fake({ [claimPath]: { vehicleId: "v1" }, "vehicles/v1": { deletedAt: null, registrationNumber: P } });
    expect(await claimIsHeldByOther(db, tx, T, O, P, null)).toBe(true);
  });
  it("the same car does not conflict with itself", async () => {
    const { db, tx } = fake({ [claimPath]: { vehicleId: "v1" }, "vehicles/v1": { deletedAt: null, registrationNumber: P } });
    expect(await claimIsHeldByOther(db, tx, T, O, P, "v1")).toBe(false);
  });
  it("an archived holder, a released claim, a missing car, or a changed plate never block", async () => {
    for (const store of [
      { [claimPath]: { vehicleId: "v1" }, "vehicles/v1": { deletedAt: "2026-01-01", registrationNumber: P } },
      { [claimPath]: { vehicleId: null } },
      { [claimPath]: { vehicleId: "v9" } },
      { [claimPath]: { vehicleId: "v1" }, "vehicles/v1": { deletedAt: null, registrationNumber: "GJ01AA0001" } },
    ] as Store[]) {
      const { db, tx } = fake(store);
      expect(await claimIsHeldByOther(db, tx, T, O, P, null)).toBe(false);
    }
  });
  it("writeClaim records the holder and release only touches your own claim", async () => {
    const { db, tx, writes } = fake({});
    writeClaim(db, tx, T, O, P, "v1", "now");
    expect(writes[0]?.data).toMatchObject({ vehicleId: "v1", plate: P });
    await releaseClaim(db, tx, { vehicleId: "v2" }, T, O, P, "v1", "now");
    expect(writes).toHaveLength(1);
    await releaseClaim(db, tx, { vehicleId: "v1" }, T, O, P, "v1", "now");
    expect(writes[1]?.data).toMatchObject({ vehicleId: null });
  });
});
