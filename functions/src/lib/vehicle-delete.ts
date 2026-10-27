// Permanent deletion of ONE car, keeping all history readable.
//  1. Stamp a vehicle snapshot onto that car's own bookings, jobs and invoices
//     (same tenant, same owner). Idempotent; only writes a field, never deletes.
//  2. In one transaction: re-check owner + tenant, refuse while a booking/job is still
//     open, write a tombstone (deletedVehicles/{id}) and delete exactly that vehicle doc.
//  3. Stamp again for anything created in the gap (needs the tombstone snapshot).
// No cascade: bookings, jobs, invoices, payments, approvals, warranties and inspections
// are never deleted or rewritten except for the added snapshot field. No bulk deletes.
// The only Storage cleanup is deleteVehiclePhotos below, run by the caller after a
// successful delete: the car's own cover/RC pictures only, never inspection or papers.
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

// ─── Photo cleanup after permanent deletion ─────────────────────────────────
// Owner policy (28 Oct 2026): when a car is permanently deleted, delete its
// pictures; pictures clicked in an inspection stay with the inspection record.
// Inspection/job photos live under {tenantId}/jobs/{jobId}/photos/ - a
// different prefix this function never touches. Here we remove ONLY the car's
// own picture objects: cover.* directly under
// {tenantId}/vehicles/{vehicleId}/. The RC photo is the registration
// certificate document (schemas/vehicle.ts; staff see it next to the customer
// licence in DocPhoto), and paper-* files are documents too - records, not
// pictures - so both are kept. Anything nested deeper is left alone.
// Runs after the Firestore delete commits, never before, so a refused delete
// (open booking/job) can never strand a car without its pictures. Idempotent:
// ignoreNotFound plus exact-name matching make a retry a no-op, and the
// alreadyDeleted retry path in permanentlyDeleteVehicle re-runs this sweep.

export interface DeletableStorageFile {
  name: string;
  delete(options: { ignoreNotFound: boolean }): Promise<unknown>;
}

export interface VehiclePhotoBucketLike {
  getFiles(options: { prefix: string }): Promise<[DeletableStorageFile[], ...unknown[]]>;
}

export interface VehiclePhotoCleanupResult {
  deleted: number;
  failed: boolean;
}

export function isVehiclePictureObject(folderPrefix: string, name: string): boolean {
  if (!name.startsWith(folderPrefix)) return false;
  const rest = name.slice(folderPrefix.length);
  if (rest.includes("/")) return false; // never reach into nested paths
  return rest.startsWith("cover.");
}

export async function deleteVehiclePhotos(
  bucket: VehiclePhotoBucketLike,
  tenantId: string,
  vehicleId: string,
): Promise<VehiclePhotoCleanupResult> {
  const folder = `${tenantId}/vehicles/${vehicleId}/`;
  const [files] = await bucket.getFiles({ prefix: folder });
  const targets = files.filter((f) => isVehiclePictureObject(folder, f.name));
  let deleted = 0;
  let failed = false;
  for (const f of targets) {
    try {
      await f.delete({ ignoreNotFound: true });
      deleted += 1;
    } catch {
      failed = true; // one bad object must not block the rest; the retry path re-sweeps
    }
  }
  return { deleted, failed };
}

// Durable cleanup truth: the sweep result is recorded on the tombstone
// (deletedVehicles/{vehicleId}) so a failure is visible after the car is gone
// from every UI, and retries can find it. Two retry paths exist: the daily
// maintenance job retries failed tombstones (see expireStaleApprovalsScheduled),
// and the owner/admin re-issuing the same delete (alreadyDeleted path)
// re-runs the sweep and rewrites this status.
export type VehiclePhotoCleanupStatus = "done" | "failed";

export async function recordVehiclePhotoCleanup(
  db: Firestore,
  tenantId: string,
  vehicleId: string,
  result: VehiclePhotoCleanupResult,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  const tombRef = db.collection(COLLECTIONS.deletedVehicles()).doc(vehicleId);
  const tomb = await tombRef.get();
  if (!tomb.exists) return; // delete never completed; nothing to annotate
  if ((tomb.data() as DeletedVehicle).tenantId !== tenantId) return; // never annotate another tenant's record
  const status: VehiclePhotoCleanupStatus = result.failed ? "failed" : "done";
  await tombRef.update({ photoCleanup: { status, deleted: result.deleted, attemptedAt: nowIso } });
}

// Bounded retry pass over ONLY the tombstones this flow marked failed.
// Admission rotation without a composite index: read a bounded window of
// failed tombstones, attempt the least-recently-attempted first, cap attempts
// per pass - a persistently failing car can never starve the others.
// Returns counts so the caller can log; per-car status is on the tombstone.
export interface VehiclePhotoCleanupRetryOutcome {
  attempted: number;
  healed: number;
  stillFailing: number;
}

const PHOTO_CLEANUP_RETRY_LIMIT = 25;

export async function retryFailedVehiclePhotoCleanups(
  db: Firestore,
  bucket: VehiclePhotoBucketLike,
  limit: number = PHOTO_CLEANUP_RETRY_LIMIT,
  nowIso: string = new Date().toISOString(),
): Promise<VehiclePhotoCleanupRetryOutcome> {
  const snap = await db
    .collection(COLLECTIONS.deletedVehicles())
    .where("photoCleanup.status", "==", "failed")
    .limit(100)
    .get();
  const oldestFirst = [...snap.docs].sort(
    (a, b) =>
      String((a.data() as DeletedVehicle).photoCleanup?.attemptedAt ?? "").localeCompare(
        String((b.data() as DeletedVehicle).photoCleanup?.attemptedAt ?? ""),
      ),
  );
  const out: VehiclePhotoCleanupRetryOutcome = { attempted: 0, healed: 0, stillFailing: 0 };
  for (const doc of oldestFirst.slice(0, limit)) {
    const tomb = doc.data() as DeletedVehicle;
    out.attempted += 1;
    const result = await deleteVehiclePhotos(bucket, tomb.tenantId, tomb.id);
    await recordVehiclePhotoCleanup(db, tomb.tenantId, tomb.id, result, nowIso);
    if (result.failed) out.stillFailing += 1;
    else out.healed += 1;
  }
  return out;
}
