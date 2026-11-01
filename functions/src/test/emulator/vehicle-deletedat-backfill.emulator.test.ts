// Legacy deletedAt normalization PROTOTYPE: scoping is mandatory, eligibility
// needs independent owner/tenant/provenance/lifecycle evidence, uncertain rows
// quarantine untouched, apply binds to the reviewed manifest digest, the
// transaction reports only its committed outcome, and exactly one field is
// written. Emulator only - no live target is authorized or touched.
import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { backfillVehicleDeletedAt } from "../../lib/vehicle-deletedat-backfill.js";

const db = getFirestore();
const T = "t";

const base = {
  tenantId: T,
  ownerId: "cust-1",
  registrationNumber: "GJ01AB1234",
  make: "Honda",
  model: "City",
  year: 2022,
  color: "Grey",
  category: "sedan",
  photoUrl: null,
  odometer: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-06-01T10:00:00.000Z", // legacy fingerprint: must survive byte-identical
  revision: 3,
};

async function seedOwner(over: Record<string, unknown> = {}) {
  await db.collection(COLLECTIONS.customers()).doc("cust-1").set({
    id: "cust-1", tenantId: T, authUid: "cust-1", name: "Owner", phone: "+919000000001",
    notificationPrefs: { push: true, quietMode: false },
    createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z", deletedAt: null, ...over,
  });
}

async function wipe() {
  for (const name of [COLLECTIONS.vehicles(), COLLECTIONS.auditLog(), COLLECTIONS.customers(), COLLECTIONS.deletedVehicles()]) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

describe("vehicle deletedAt legacy backfill (prototype)", () => {
  beforeEach(wipe);

  it("refuses an unscoped scan", async () => {
    await expect(backfillVehicleDeletedAt(db, { apply: false })).rejects.toThrow(/unscoped/);
  });

  it("dry run identifies candidates, quarantines unproven rows, writes NOTHING", async () => {
    await seedOwner();
    await db.collection(COLLECTIONS.vehicles()).doc("legacy").set({ ...base });
    await db.collection(COLLECTIONS.vehicles()).doc("noowner").set({ ...base, ownerId: "ghost" });
    const before = (await db.collection(COLLECTIONS.vehicles()).doc("legacy").get()).data();
    const result = await backfillVehicleDeletedAt(db, { apply: false, tenantId: T });
    expect(result.missing.sort()).toEqual(["legacy", "noowner"]);
    expect(result.eligible).toEqual(["legacy"]);
    expect(result.quarantined).toEqual([{ id: "noowner", reason: "owner customer document missing" }]);
    expect(result.manifestDigest).toMatch(/^[0-9a-f]{64}$/);
    expect((await db.collection(COLLECTIONS.vehicles()).doc("legacy").get()).data()).toEqual(before);
    expect((await db.collection(COLLECTIONS.auditLog()).get()).size).toBe(0);
  });

  it("quarantine evidence: cross-tenant owner, archived owner, and a lifecycle tombstone are never written", async () => {
    await seedOwner();
    await db.collection(COLLECTIONS.vehicles()).doc("xt-tenant").set({ ...base, tenantId: "other" });
    await db.collection(COLLECTIONS.vehicles()).doc("archived-owner").set({ ...base });
    await db.collection(COLLECTIONS.vehicles()).doc("tombstoned").set({ ...base });
    // archived-owner's owner becomes archived AFTER the cars exist
    const result1 = await backfillVehicleDeletedAt(db, { apply: false, tenantId: T });
    expect(result1.eligible.sort()).toEqual(["archived-owner", "tombstoned"]);
    await db.collection(COLLECTIONS.customers()).doc("cust-1").update({ deletedAt: "2025-05-01T00:00:00.000Z" });
    await db.collection(COLLECTIONS.deletedVehicles()).doc("tombstoned").set({
      id: "tombstoned", tenantId: T, ownerId: "cust-1",
      snapshot: { registrationNumber: "GJ01AB1234", make: "Honda", model: "City", year: 2022, color: "Grey", photoUrl: null },
      deletedAt: "2025-04-01T00:00:00.000Z", deletedBy: "admin-1",
    });
    const result2 = await backfillVehicleDeletedAt(db, { apply: false, tenantId: T });
    expect(result2.eligible).toEqual([]);
    expect(result2.quarantined.map((q) => q.id).sort()).toEqual(["archived-owner", "tombstoned"]);
    // cross-tenant doc invisible to this tenant's scope entirely
    const result3 = await backfillVehicleDeletedAt(db, { apply: false, tenantId: "other" });
    expect(result3.quarantined).toEqual([{ id: "xt-tenant", reason: "owner customer is in a different tenant" }]);
  });

  it("apply binds to the REVIEWED manifest digest and refuses a mismatch", async () => {
    await seedOwner();
    await db.collection(COLLECTIONS.vehicles()).doc("legacy").set({ ...base });
    const dry = await backfillVehicleDeletedAt(db, { apply: false, tenantId: T });
    await expect(backfillVehicleDeletedAt(db, { apply: true, tenantId: T, performedBy: "tester", manifestDigest: "0".repeat(64) }))
      .rejects.toThrow(/manifest digest mismatch/);
    expect((await db.collection(COLLECTIONS.vehicles()).doc("legacy").get()).data()).toEqual(base); // untouched
    const applied = await backfillVehicleDeletedAt(db, { apply: true, tenantId: T, performedBy: "tester (ref T-1)", manifestDigest: dry.manifestDigest, now: () => "2026-10-31T00:00:00.000Z" });
    expect(applied.outcomes).toEqual({ legacy: "applied" });
    const legacy = (await db.collection(COLLECTIONS.vehicles()).doc("legacy").get()).data()!;
    expect(legacy).toEqual({ ...base, deletedAt: null }); // exactly one new key
    const audits = await db.collection(COLLECTIONS.auditLog()).get();
    expect(audits.size).toBe(1);
    expect(audits.docs[0]!.data().performedBy).toBe("tester (ref T-1)");
    expect(applied.auditIds).toEqual([audits.docs[0]!.data().id]);
  });

  it("apply requires attributable performedBy", async () => {
    await seedOwner();
    await db.collection(COLLECTIONS.vehicles()).doc("legacy").set({ ...base });
    const dry = await backfillVehicleDeletedAt(db, { apply: false, tenantId: T });
    await expect(backfillVehicleDeletedAt(db, { apply: true, tenantId: T, manifestDigest: dry.manifestDigest }))
      .rejects.toThrow(/performedBy/);
  });

  it("between-scan normalization: the transaction reports ONLY its committed outcome (retry-skip is not 'applied')", async () => {
    await seedOwner();
    await db.collection(COLLECTIONS.vehicles()).doc("legacy").set({ ...base });
    const dry = await backfillVehicleDeletedAt(db, { apply: false, tenantId: T });
    const before = (await db.collection(COLLECTIONS.vehicles()).doc("legacy").get()).data();
    // Deterministic race: the doc gains the field AFTER the scan, BEFORE the TX.
    const result = await backfillVehicleDeletedAt(db, {
      apply: true, tenantId: T, performedBy: "tester", manifestDigest: dry.manifestDigest,
      beforeWrite: async (id) => { await db.collection(COLLECTIONS.vehicles()).doc(id).update({ deletedAt: null }); },
    });
    expect(result.outcomes).toEqual({ legacy: "skipped-already-normalized" }); // never misreported as applied
    expect(result.auditIds).toEqual([]); // no phantom audit entry
    expect((await db.collection(COLLECTIONS.vehicles()).doc("legacy").get()).data()).toEqual({ ...before, deletedAt: null });
    expect((await db.collection(COLLECTIONS.auditLog()).get()).size).toBe(0);
  });

  it("owner archived BETWEEN scan and transaction: the in-transaction evidence check skips instead of applying", async () => {
    await seedOwner();
    await db.collection(COLLECTIONS.vehicles()).doc("legacy").set({ ...base });
    const dry = await backfillVehicleDeletedAt(db, { apply: false, tenantId: T });
    const result = await backfillVehicleDeletedAt(db, {
      apply: true, tenantId: T, performedBy: "tester", manifestDigest: dry.manifestDigest,
      beforeWrite: async () => { await db.collection(COLLECTIONS.customers()).doc("cust-1").update({ deletedAt: "2026-10-31T01:00:00.000Z" }); },
    });
    expect(result.outcomes).toEqual({ legacy: "skipped-no-longer-eligible" }); // manifest binding survives scan-to-TX change
    expect(result.auditIds).toEqual([]);
    expect((await db.collection(COLLECTIONS.vehicles()).doc("legacy").get()).data()).toEqual(base); // untouched
    expect((await db.collection(COLLECTIONS.auditLog()).get()).size).toBe(0);
  });

  it("re-running apply is a no-op (idempotent) and paginates within the scope", async () => {
    await seedOwner();
    await db.collection(COLLECTIONS.vehicles()).doc("a").set({ ...base });
    await db.collection(COLLECTIONS.vehicles()).doc("b").set({ ...base });
    await db.collection(COLLECTIONS.vehicles()).doc("c").set({ ...base, deletedAt: null });
    const dry = await backfillVehicleDeletedAt(db, { apply: false, tenantId: T, pageSize: 1 });
    expect(dry.missing.sort()).toEqual(["a", "b"]); // pageSize 1 forces pagination across pages
    const first = await backfillVehicleDeletedAt(db, { apply: true, tenantId: T, performedBy: "tester", manifestDigest: dry.manifestDigest, pageSize: 1 });
    expect(first.outcomes).toEqual({ a: "applied", b: "applied" });
    const secondDry = await backfillVehicleDeletedAt(db, { apply: false, tenantId: T });
    expect(secondDry.missing).toEqual([]);
    const audits = await db.collection(COLLECTIONS.auditLog()).get();
    expect(audits.size).toBe(2);
  });
});
