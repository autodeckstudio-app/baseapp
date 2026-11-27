// Capacity serialization and physical holds shared by every allocation path.
//
// Type locks: bayLocks/{tenant}__{studio}__type__{bayType}. Every transaction that can ADD occupancy of a bay type
// (new booking, reschedule, assignment, walk-in, standby admission, visit move/schedule, bay type change or
// deactivation) reads the type lock(s) before its occupancy checks and writes them with its allocation, so two
// allocations of the same type cannot both pass on stale occupancy. Locks are read one at a time in sorted order
// (consistent lock order; no parallel transaction reads). Pure releases stay lock-free: a release only removes
// occupancy, so a concurrent allocation that misses it is conservative, never a double allocation.
// The existing per-bay locks are kept unchanged alongside, so older code paths keep their existing behaviour.
//
// Physical holds: a vehicle recorded in a bay in VEHICLE_RECEIVED .. READY_FOR_DELIVERY without a release receipt
// occupies that bay whatever its estimated end says (overrun, overnight, closed days). Such a bay is not offered or
// allocated to another vehicle until staff release or move it. No far-future dates are used: the bay is excluded.
// Emulator tests prove behaviour only; they do not prove production concurrency safety.
import type { DocumentReference, Firestore, Query, QuerySnapshot, Transaction } from "firebase-admin/firestore";
import { hasReleasedBay, type BayType, type ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

export const PRESENT_IN_BAY_STATUSES = ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"] as const;

export function bayTypeLockRef(db: Firestore, tenantId: string, studioId: string, bayType: BayType): DocumentReference {
  return db.collection(COLLECTIONS.bayLocks()).doc(`${tenantId}__${studioId}__type__${bayType}`);
}

/** Read the type locks for these bay types in sorted order, one at a time. Call before any occupancy query. */
export async function readBayTypeLocks(tx: Transaction, db: Firestore, tenantId: string, studioId: string, types: Iterable<BayType>): Promise<DocumentReference[]> {
  const refs = [...new Set(types)].sort().map((t) => bayTypeLockRef(db, tenantId, studioId, t));
  for (const ref of refs) await tx.get(ref);
  return refs;
}

/** Write the type locks read by readBayTypeLocks, together with the allocation writes. */
export function writeBayTypeLocks(tx: Transaction, refs: readonly DocumentReference[], nowIso: string): void {
  for (const ref of refs) tx.set(ref, { lastAssignedAt: nowIso });
}

/** True for the error Firestore returns when the transaction itself was closed before it committed
 *  (gRPC INVALID_ARGUMENT "Transaction is invalid or closed"), e.g. after a lock-wait timeout under contention.
 *  The SDK retries ABORTED but not this; nothing was committed. */
/** Approved physical-hold rule: cancelling a booking whose car has already arrived never frees the bay it occupies. The job keeps
 *  the hold (cancelledHeldJobIds) until staff explicitly release it (releaseCompletedBay). Spread into the job's CANCELLED update. */
export function heldAfterCancelFields(job: { status: string; bayId?: string | null }, nowIso: string): { heldAfterCancel?: true; heldAfterCancelAt?: string } {
  return job.status === "VEHICLE_RECEIVED" && job.bayId ? { heldAfterCancel: true, heldAfterCancelAt: nowIso } : {};
}

export function isClosedTransactionError(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown } | null;
  return !!err && err.code === 3 && typeof err.message === "string" && /transaction is invalid or closed/i.test(err.message);
}

/** db.runTransaction for capacity allocations, plus a bounded fresh retry when the transaction was closed before it
 *  committed (isClosedTransactionError). The retry re-reads current occupancy, so the loser of a race sees the
 *  winner's allocation. Every other error is rethrown unchanged. */
export async function runCapacityTransaction<T>(db: Firestore, fn: (tx: Transaction) => Promise<T>, options?: { maxAttempts?: number }, closedRetries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await (options ? db.runTransaction(fn, options) : db.runTransaction(fn));
    } catch (e) {
      if (attempt >= closedRetries || !isClosedTransactionError(e)) throw e;
    }
  }
}

/** Bays (of those given) where a vehicle is physically present and not released. `exceptJobIds` excludes the
 *  caller's own jobs (replanning the same vehicle). Reads one bay at a time. */
export async function physicallyHeldBayIds(get: (q: Query) => Promise<QuerySnapshot>, db: Firestore, studioId: string, bayIds: readonly string[], exceptJobIds: readonly string[] = []): Promise<Set<string>> {
  const held = new Set<string>();
  for (const bayId of bayIds) {
    const snap = await get(db.collection(COLLECTIONS.jobs()).where("studioId", "==", studioId).where("bayId", "==", bayId).where("status", "in", [...PRESENT_IN_BAY_STATUSES]));
    if (snap.docs.some((d) => !exceptJobIds.includes(d.id) && !hasReleasedBay(d.data() as ServiceJob))) held.add(bayId);
    else if ((await cancelledHeldJobIds(get, db, studioId, bayId)).some((id) => !exceptJobIds.includes(id))) held.add(bayId);
  }
  return held;
}

/** Jobs whose booking was cancelled while the car was physically in this bay (heldAfterCancel === true): the bay stays
 *  held until staff explicitly release it. Equality-only query: no composite index required. */
export async function cancelledHeldJobIds(get: (q: Query) => Promise<QuerySnapshot>, db: Firestore, studioId: string, bayId: string): Promise<string[]> {
  const snap = await get(db.collection(COLLECTIONS.jobs()).where("studioId", "==", studioId).where("bayId", "==", bayId).where("heldAfterCancel", "==", true));
  // Re-checked in memory, never trusting the query filter alone: only a cancelled job still holding THIS bay counts.
  return snap.docs.filter((d) => { const j = d.data() as ServiceJob; return j.status === "CANCELLED" && j.heldAfterCancel === true && j.studioId === studioId && j.bayId === bayId; }).map((d) => d.id);
}
