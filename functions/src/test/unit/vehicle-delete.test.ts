import { describe, it, expect } from "vitest";
import { permanentlyDeleteVehicle, deleteVehiclePhotos, isVehiclePictureObject, recordVehiclePhotoCleanup, retryFailedVehiclePhotoCleanups, VehicleDeleteError } from "../../lib/vehicle-delete.js";
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

describe("deleteVehiclePhotos", () => {
  const fakeBucket = (names: string[], failNames: string[] = []) => {
    const deleted: string[] = [];
    const bucket = {
      getFiles: async ({ prefix }: { prefix: string }) => {
        const files = names
          .filter((n) => n.startsWith(prefix))
          .map((n) => ({
            name: n,
            delete: async (_opts: { ignoreNotFound: boolean }) => {
              if (failNames.includes(n)) throw new Error("storage down");
              deleted.push(n);
            },
          }));
        return [files] as [unknown];
      },
    };
    return { bucket: bucket as never, deleted };
  };

  it("matches only cover.* and rc.* directly in the car folder", () => {
    const folder = "t/vehicles/v1/";
    expect(isVehiclePictureObject(folder, "t/vehicles/v1/cover.a.jpg")).toBe(true);
    expect(isVehiclePictureObject(folder, "t/vehicles/v1/rc.b.png")).toBe(false); // RC is a document, kept
    expect(isVehiclePictureObject(folder, "t/vehicles/v1/paper-p1.jpg")).toBe(false);
    expect(isVehiclePictureObject(folder, "t/vehicles/v1/nested/cover.c.jpg")).toBe(false);
    expect(isVehiclePictureObject(folder, "t/vehicles/v2/cover.d.jpg")).toBe(false);
    expect(isVehiclePictureObject(folder, "t/jobs/j1/photos/e.jpg")).toBe(false);
  });

  it("deletes only the cover picture, keeps RC, papers and every other car and job photo", async () => {
    const { bucket, deleted } = fakeBucket([
      "t/vehicles/v1/cover.1.jpg",
      "t/vehicles/v1/rc.2.jpg",
      "t/vehicles/v1/paper-p1.jpg",
      "t/vehicles/v2/cover.3.jpg",
      "t/jobs/j1/photos/4.jpg",
    ]);
    const r = await deleteVehiclePhotos(bucket, "t", "v1");
    expect(r).toEqual({ deleted: 1, failed: false });
    expect(deleted).toEqual(["t/vehicles/v1/cover.1.jpg"]);
  });

  it("is a no-op on retry when the pictures are already gone", async () => {
    const { bucket, deleted } = fakeBucket(["t/vehicles/v1/paper-p1.jpg"]);
    const r = await deleteVehiclePhotos(bucket, "t", "v1");
    expect(r).toEqual({ deleted: 0, failed: false });
    expect(deleted).toEqual([]);
  });

  it("keeps sweeping when one object fails and reports the failure", async () => {
    const { bucket, deleted } = fakeBucket(
      ["t/vehicles/v1/cover.1.jpg", "t/vehicles/v1/cover.2.jpg"],
      ["t/vehicles/v1/cover.1.jpg"],
    );
    const r = await deleteVehiclePhotos(bucket, "t", "v1");
    expect(r).toEqual({ deleted: 1, failed: true });
    expect(deleted).toEqual(["t/vehicles/v1/cover.2.jpg"]);
  });
});

describe("recordVehiclePhotoCleanup", () => {
  it("writes durable cleanup truth on the tombstone and never touches another tenant", async () => {
    const { db, data } = fakeFirestore(seed());
    await permanentlyDeleteVehicle(db, owner, "v1", noAudit);
    await recordVehiclePhotoCleanup(db, "t", "v1", { deleted: 1, failed: false }, "2026-10-28T00:00:00Z");
    expect(data.deletedVehicles!.v1!.photoCleanup).toEqual({ status: "done", deleted: 1, attemptedAt: "2026-10-28T00:00:00Z" });
    // snapshot and identity survive the annotation
    expect(data.deletedVehicles!.v1!.snapshot).toMatchObject({ registrationNumber: "GJ01AB1234" });
    expect(data.deletedVehicles!.v1!.ownerId).toBe("c1");
    await recordVehiclePhotoCleanup(db, "t", "v1", { deleted: 0, failed: true }, "2026-10-28T01:00:00Z");
    expect(data.deletedVehicles!.v1!.photoCleanup).toMatchObject({ status: "failed", deleted: 0 });
    // wrong tenant: not annotated
    await recordVehiclePhotoCleanup(db, "other", "v1", { deleted: 9, failed: false }, "2026-10-28T02:00:00Z");
    expect(data.deletedVehicles!.v1!.photoCleanup).toMatchObject({ status: "failed", deleted: 0 });
    // no tombstone: no-op, no throw
    await recordVehiclePhotoCleanup(db, "t", "v2", { deleted: 1, failed: false });
    expect(data.deletedVehicles!.v2).toBeUndefined();
  });
});

describe("retryFailedVehiclePhotoCleanups", () => {
  const bucketFor = (names: string[]) => ({
    getFiles: async ({ prefix }: { prefix: string }) => [
      names.filter((n) => n.startsWith(prefix)).map((n) => ({ name: n, delete: async () => {} })),
    ] as [unknown],
  });

  it("retries only failed tombstones and heals them", async () => {
    const { db, data } = fakeFirestore(seed());
    await permanentlyDeleteVehicle(db, owner, "v1", noAudit);
    data.deletedVehicles!.v1!.photoCleanup = { status: "failed", deleted: 0, attemptedAt: "2026-10-28T00:00:00Z" };
    const out = await retryFailedVehiclePhotoCleanups(db, bucketFor(["t/vehicles/v1/cover.1.jpg"]) as never, 25, "2026-10-28T03:00:00Z");
    expect(out).toEqual({ attempted: 1, healed: 1, stillFailing: 0 });
    expect(data.deletedVehicles!.v1!.photoCleanup).toEqual({ status: "done", deleted: 1, attemptedAt: "2026-10-28T03:00:00Z" });
    // second pass: nothing failed, no attempts
    const again = await retryFailedVehiclePhotoCleanups(db, bucketFor([]) as never);
    expect(again).toEqual({ attempted: 0, healed: 0, stillFailing: 0 });
  });
});
