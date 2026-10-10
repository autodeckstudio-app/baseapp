// Permanent deletion of ONE car, keeping all history readable.
//  1. Stamp a vehicle snapshot onto that car's own bookings, jobs and invoices
//     (same tenant, same owner). Idempotent; only writes a field, never deletes.
//  2. In one transaction: re-check owner + tenant, refuse while a booking/job is still
//     open, write a tombstone (deletedVehicles/{id}) and delete exactly that vehicle doc.
//  3. Stamp again for anything created in the gap (needs the tombstone snapshot).
// No cascade: bookings, jobs, invoices, payments, approvals, warranties and inspections
// are never deleted or rewritten except for the added snapshot field. No bulk deletes.
import type { Firestore, QueryDocumentSnapshot, Transaction } from "firebase-admin/firestore";
import type { Booking, DeletedVehicle, ServiceJob, Vehicle, VehicleSnapshot } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { snapshotVehicle } from "./job-invoice.js";

const OPEN_BOOKING = new Set(["PENDING", "CONFIRMED", "ACTIVE"]);
const CLOSED_JOB = new Set(["DELIVERED", "CANCELLED"]);

export interface VehicleDeleteActor {
  uid: string;
  role: string;
  tenantId: string;
}

export class VehicleDeleteError extends Error {
  constructor(
    public readonly code: "not-found" | "permission-denied" | "failed-precondition",
    message: string,
  ) {
    super(message);
  }
}

export interface VehicleDeleteResult {
  vehicleId: string;
  deleted: true;
  alreadyDeleted: boolean;
  stamped: { bookings: number; jobs: number; invoices: number };
}

type AuditFn = (tx: Transaction, entry: {
  vehicleId: string;
  snapshot: VehicleSnapshot;
  ownerId: string;
}) => void;

async function stamp(
  db: Firestore,
  tenantId: string,
  ownerId: string,
  vehicleId: string,
  snapshot: VehicleSnapshot,
): Promise<VehicleDeleteResult["stamped"]> {
  const out = { bookings: 0, jobs: 0, invoices: 0 };
  const targets: Array<[keyof typeof out, string]> = [
    ["bookings", COLLECTIONS.bookings()],
    ["jobs", COLLECTIONS.jobs()],
    ["invoices", COLLECTIONS.invoices()],
  ];
  for (const [key, col] of targets) {
    const snap = await db
      .collection(col)
      .where("vehicleId", "==", vehicleId)
      .where("tenantId", "==", tenantId)
      .get();
    const todo = snap.docs.filter(
      (d: QueryDocumentSnapshot) => d.get("customerId") === ownerId && !d.get("vehicleSnapshot"),
    );
    for (let i = 0; i < todo.length; i += 400) {
      const batch = db.batch();
      for (const d of todo.slice(i, i + 400)) batch.update(d.ref, { vehicleSnapshot: snapshot });
      await batch.commit();
    }
    out[key] += todo.length;
  }
  return out;
}

async function assertNothingOpen(db: Firestore, vehicleId: string, tenantId: string, tx?: Transaction): Promise<void> {
  const read = <T,>(q: { get: () => Promise<T> }): Promise<T> => (tx ? (tx.get as (x: unknown) => Promise<T>)(q) : q.get());
  const [bookings, jobs] = await Promise.all([
    read(db.collection(COLLECTIONS.bookings()).where("vehicleId", "==", vehicleId).where("tenantId", "==", tenantId)),
    read(db.collection(COLLECTIONS.jobs()).where("vehicleId", "==", vehicleId).where("tenantId", "==", tenantId)),
  ]);
  if (bookings.docs.some((d) => OPEN_BOOKING.has((d.data() as Booking).status))) {
    throw new VehicleDeleteError("failed-precondition", "This car has an upcoming booking. Cancel it first.");
  }
  if (jobs.docs.some((d) => !CLOSED_JOB.has((d.data() as ServiceJob).status))) {
    throw new VehicleDeleteError("failed-precondition", "This car has a service in progress.");
  }
}

export async function permanentlyDeleteVehicle(
  db: Firestore,
  actor: VehicleDeleteActor,
  vehicleId: string,
  audit: AuditFn,
  nowIso: string = new Date().toISOString(),
): Promise<VehicleDeleteResult> {
  const ref = db.collection(COLLECTIONS.vehicles()).doc(vehicleId);
  const tombRef = db.collection(COLLECTIONS.deletedVehicles()).doc(vehicleId);

  const first = await ref.get();
  if (!first.exists) {
    // Retry after a completed delete: finish any gap stamping, never fail loudly for the owner.
    const tomb = await tombRef.get();
    if (tomb.exists) {
      const t = tomb.data() as DeletedVehicle;
      if (t.tenantId !== actor.tenantId) throw new VehicleDeleteError("not-found", "Vehicle not found.");
      if (actor.role === "customer" && t.ownerId !== actor.uid) {
        throw new VehicleDeleteError("permission-denied", "You do not own this vehicle.");
      }
      const stamped = await stamp(db, t.tenantId, t.ownerId, vehicleId, t.snapshot);
      return { vehicleId, deleted: true, alreadyDeleted: true, stamped };
    }
    throw new VehicleDeleteError("not-found", "Vehicle not found.");
  }

  const vehicle = first.data() as Vehicle;
  // Existence of another tenant's car is not disclosed.
  if (vehicle.tenantId !== actor.tenantId) throw new VehicleDeleteError("not-found", "Vehicle not found.");
  if (actor.role === "customer" && vehicle.ownerId !== actor.uid) {
    throw new VehicleDeleteError("permission-denied", "You do not own this vehicle.");
  }
  if (!["customer", "admin", "superadmin"].includes(actor.role)) {
    throw new VehicleDeleteError("permission-denied", "Only the owner or an admin can delete a vehicle.");
  }

  const snapshot = snapshotVehicle(vehicle);

  // Cheap early check so the common case fails before any stamping. NOT authoritative:
  // the same check runs again inside the delete transaction below.
  await assertNothingOpen(db, vehicleId, vehicle.tenantId);

  const stamped = await stamp(db, vehicle.tenantId, vehicle.ownerId, vehicleId, snapshot);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return; // concurrent identical delete already finished
    const v = snap.data() as Vehicle;
    // Authoritative check: queries read inside the transaction, so a booking or job
    // written concurrently makes this transaction retry/abort instead of slipping through.
    await assertNothingOpen(db, vehicleId, v.tenantId, tx);
    if (v.tenantId !== actor.tenantId || v.ownerId !== vehicle.ownerId) {
      throw new VehicleDeleteError("permission-denied", "Vehicle ownership changed.");
    }
    const tomb: DeletedVehicle = {
      id: vehicleId,
      tenantId: v.tenantId,
      ownerId: v.ownerId,
      snapshot: snapshotVehicle(v),
      deletedAt: nowIso,
      deletedBy: actor.uid,
    };
    tx.set(tombRef, tomb);
    tx.delete(ref);
    audit(tx, { vehicleId, snapshot: tomb.snapshot, ownerId: v.ownerId });
  });

  const late = await stamp(db, vehicle.tenantId, vehicle.ownerId, vehicleId, snapshot);
  stamped.bookings += late.bookings;
  stamped.jobs += late.jobs;
  stamped.invoices += late.invoices;
  return { vehicleId, deleted: true, alreadyDeleted: false, stamped };
}
