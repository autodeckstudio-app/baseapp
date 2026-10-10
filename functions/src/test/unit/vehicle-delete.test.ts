import { describe, it, expect } from "vitest";
import { permanentlyDeleteVehicle, VehicleDeleteError } from "../../lib/vehicle-delete.js";
import { buildNotification } from "../../lib/notification-events.js";
import { fakeFirestore } from "./fake-firestore.js";

const car = { tenantId: "t", ownerId: "c1", registrationNumber: "GJ01AB1234", make: "Tata", model: "Nexon", year: 2022, color: "Blue", photoUrl: null };
const seed = () => ({
  vehicles: { v1: car, v2: { ...car, registrationNumber: "GJ02ZZ0001" }, vx: { ...car, tenantId: "other", ownerId: "cx" } },
  bookings: { b1: { tenantId: "t", customerId: "c1", vehicleId: "v1", status: "COMPLETED" }, b2: { tenantId: "t", customerId: "c1", vehicleId: "v2", status: "COMPLETED" } },
  jobs: { j1: { tenantId: "t", customerId: "c1", vehicleId: "v1", status: "DELIVERED" }, j2: { tenantId: "t", customerId: "c1", vehicleId: "v1", status: "DELIVERED" } },
  invoices: { i1: { tenantId: "t", customerId: "c1", vehicleId: "v1", jobId: "j1", total: 1000, lineItems: [{ description: "Wash" }] }, i2: { tenantId: "t", customerId: "c1", vehicleId: "v2", jobId: "x", total: 5 } },
  payments: { p1: { tenantId: "t", jobId: "j1" } },
  warranties: { w1: { tenantId: "t", vehicleId: "v1" } },
}) as Record<string, Record<string, Record<string, unknown>>>;
const owner = { uid: "c1", role: "customer", tenantId: "t" };
const noAudit = () => {};

describe("permanentlyDeleteVehicle", () => {
  it("deletes only that car; history keeps snapshots, identities and totals; nothing else removed", async () => {
    const { db, data } = fakeFirestore(seed());
    const r = await permanentlyDeleteVehicle(db, owner, "v1", noAudit, "2026-10-10T00:00:00Z");
    expect(r).toMatchObject({ deleted: true, alreadyDeleted: false });
    expect(data.vehicles!.v1).toBeUndefined();
    expect(data.vehicles!.v2).toBeDefined();
    expect(data.vehicles!.vx).toBeDefined();
    expect(data.deletedVehicles!.v1).toMatchObject({ ownerId: "c1", tenantId: "t", deletedBy: "c1", snapshot: { registrationNumber: "GJ01AB1234", model: "Nexon" } });
    for (const [col, id] of [["bookings", "b1"], ["jobs", "j1"], ["jobs", "j2"], ["invoices", "i1"]] as const) {
      expect(data[col]![id]!.vehicleSnapshot).toMatchObject({ registrationNumber: "GJ01AB1234" });
      expect(data[col]![id]!.vehicleId).toBe("v1");
    }
    expect(data.invoices!.i1).toMatchObject({ jobId: "j1", total: 1000 });
    // other car's records untouched
    expect(data.bookings!.b2!.vehicleSnapshot).toBeUndefined();
    expect(data.invoices!.i2!.vehicleSnapshot).toBeUndefined();
    // no cascade
    expect(Object.keys(data.bookings!)).toHaveLength(2);
    expect(Object.keys(data.jobs!)).toHaveLength(2);
    expect(Object.keys(data.invoices!)).toHaveLength(2);
    expect(data.payments!.p1).toBeDefined();
    expect(data.warranties!.w1).toBeDefined();
  });

  it("refuses another owner and another tenant, deleting nothing", async () => {
    const { db, data } = fakeFirestore(seed());
    await expect(permanentlyDeleteVehicle(db, { uid: "c9", role: "customer", tenantId: "t" }, "v1", noAudit)).rejects.toMatchObject({ code: "permission-denied" });
    await expect(permanentlyDeleteVehicle(db, { uid: "a", role: "admin", tenantId: "t" }, "vx", noAudit)).rejects.toMatchObject({ code: "not-found" });
    await expect(permanentlyDeleteVehicle(db, { uid: "s", role: "studio", tenantId: "t" }, "v1", noAudit)).rejects.toBeInstanceOf(VehicleDeleteError);
    expect(data.vehicles!.v1).toBeDefined();
    expect(data.vehicles!.vx).toBeDefined();
    expect(data.deletedVehicles).toBeUndefined();
    expect(data.bookings!.b1!.vehicleSnapshot).toBeUndefined();
  });

  it("admin of the same tenant may delete", async () => {
    const { db, data } = fakeFirestore(seed());
    await permanentlyDeleteVehicle(db, { uid: "a", role: "admin", tenantId: "t" }, "v1", noAudit);
    expect(data.vehicles!.v1).toBeUndefined();
  });

  it("blocks while a booking or job is still open", async () => {
    const s = seed();
    s.bookings!.b3 = { tenantId: "t", customerId: "c1", vehicleId: "v1", status: "CONFIRMED" };
    const f = fakeFirestore(s);
    await expect(permanentlyDeleteVehicle(f.db, owner, "v1", noAudit)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(f.data.vehicles!.v1).toBeDefined();
    const s2 = seed();
    s2.jobs!.j9 = { tenantId: "t", customerId: "c1", vehicleId: "v1", status: "IN_PROGRESS" };
    const f2 = fakeFirestore(s2);
    await expect(permanentlyDeleteVehicle(f2.db, owner, "v1", noAudit)).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("race: a booking or job created after the pre-check but before the transaction aborts the delete", async () => {
    for (const [col, row] of [
      ["bookings", { tenantId: "t", customerId: "c1", vehicleId: "v1", status: "CONFIRMED" }],
      ["jobs", { tenantId: "t", customerId: "c1", vehicleId: "v1", status: "VEHICLE_RECEIVED" }],
    ] as const) {
      const f = fakeFirestore(seed(), {
        beforeTransaction: (d) => { (d[col] ??= {}).raced = row as never; },
      });
      await expect(permanentlyDeleteVehicle(f.db, owner, "v1", noAudit)).rejects.toMatchObject({ code: "failed-precondition" });
      expect(f.data.vehicles!.v1).toBeDefined();
      expect(f.data.deletedVehicles).toBeUndefined();
    }
  });

  it("is idempotent on retry and re-stamps late records", async () => {
    const { db, data } = fakeFirestore(seed());
    await permanentlyDeleteVehicle(db, owner, "v1", noAudit);
    data.jobs!.late = { tenantId: "t", customerId: "c1", vehicleId: "v1", status: "DELIVERED" };
    const again = await permanentlyDeleteVehicle(db, owner, "v1", noAudit);
    expect(again.alreadyDeleted).toBe(true);
    expect(data.jobs!.late!.vehicleSnapshot).toMatchObject({ registrationNumber: "GJ01AB1234" });
    await expect(permanentlyDeleteVehicle(db, { uid: "c9", role: "customer", tenantId: "t" }, "v1", noAudit)).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("calls the audit hook inside the delete", async () => {
    const { db } = fakeFirestore(seed());
    const seen: string[] = [];
    await permanentlyDeleteVehicle(db, owner, "v1", (_tx, e) => { seen.push(e.vehicleId); });
    expect(seen).toEqual(["v1"]);
  });
});

describe("bill-ready notification", () => {
  it("titles it 'Your bill is ready', opens the invoice, and uses a per-invoice dedupe key", async () => {
    const { db } = fakeFirestore({ invoices: { inv_j1: { id: "inv_j1", tenantId: "t", customerId: "c1", invoiceNumber: "INV-2026-00007", total: 118000 } } } as never);
    const n = await buildNotification(db, { action: "invoice.issued", entityId: "inv_j1" } as never);
    expect(n).toMatchObject({ title: "Your bill is ready", type: "invoice_issued", entityType: "Invoice", entityId: "inv_j1", userId: "c1", dedupeKey: "invoice-issued-inv_j1" });
    // retried generation yields the same notification doc id
    const again = await buildNotification(db, { action: "invoice.issued", entityId: "inv_j1" } as never);
    expect(again!.dedupeKey).toBe(n!.dedupeKey);
  });
});
