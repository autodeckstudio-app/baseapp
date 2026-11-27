// bayReservations: how one booking holds several bays independently for its scheduled stages (approved model).
// See packages/core/src/bay-reservations.ts for the record and its ownership rules.
//
// Atomicity: createBayReservations only uses tx.create inside the caller's booking transaction. Either the whole
// transaction commits (booking, job and every reservation) or nothing does; tx.create also refuses an existing id,
// so a retried booking can never duplicate or partially overwrite a reservation set.
//
// Query and index: activeReservationsForBays filters by equality only (studioId ==, bayId ==, status == "active").
// Firestore serves equality-only queries by merging its automatic single-field indexes, so NO composite index is
// required and firestore.indexes.json is unchanged. Windows are compared in code after the read. If a range filter or
// orderBy is ever added to this query, a composite index would then be needed and must be justified first.
import type { DocumentReference, Firestore, Query, QuerySnapshot, Transaction } from "firebase-admin/firestore";
import { activeReservationIntervals, type BayReservation } from "@autodeck/core";
import type { OccupiedInterval } from "./availability.js";

export const BAY_RESERVATIONS = "bayReservations";

/** Create every reservation of a booking inside its transaction (all or none). */
export function createBayReservations(tx: Transaction, db: Firestore, reservations: readonly BayReservation[]): void {
  for (const r of reservations) tx.create(db.collection(BAY_RESERVATIONS).doc(r.id), r);
}

/** Active reservations on these bays as planned-occupancy intervals (turnover included), one bay at a time.
 *  `except` skips the caller's own booking(s): one id, or every booking of a shared visit. */
export async function activeReservationsForBays(get: (q: Query) => Promise<QuerySnapshot>, db: Firestore, studioId: string, bayIds: readonly string[], except?: string | readonly string[]): Promise<Map<string, OccupiedInterval[]>> {
  const skip = new Set(typeof except === "string" ? [except] : except ?? []);
  const rows: BayReservation[] = [];
  for (const bayId of bayIds) {
    const snap = await get(db.collection(BAY_RESERVATIONS).where("studioId", "==", studioId).where("bayId", "==", bayId).where("status", "==", "active"));
    rows.push(...snap.docs.map((d) => d.data() as BayReservation).filter((r) => !skip.has(r.bookingId)));
  }
  const out = new Map<string, OccupiedInterval[]>();
  for (const [bayId, list] of activeReservationIntervals(rows)) {
    out.set(bayId, list.map((i) => ({ startAt: new Date(i.startMs), endAt: new Date(i.endMs) })));
  }
  return out;
}

/** Read (inside the cancelling transaction, before any write) the booking's ACTIVE reservations. Equality-only query
 *  (bookingId ==, status == "active"): no composite index required. */
export async function activeReservationRefsForBooking(tx: Transaction, db: Firestore, bookingId: string): Promise<DocumentReference[]> {
  const snap = await tx.get(db.collection(BAY_RESERVATIONS).where("bookingId", "==", bookingId).where("status", "==", "active"));
  return snap.docs.map((d) => d.ref);
}

/** Release every given reservation with the whole-booking cancellation (no fee or refund logic here). */
export function releaseReservations(tx: Transaction, refs: readonly DocumentReference[], actor: string, nowIso: string): void {
  for (const ref of refs) tx.update(ref, { status: "released", releasedAt: nowIso, releasedBy: actor });
}
