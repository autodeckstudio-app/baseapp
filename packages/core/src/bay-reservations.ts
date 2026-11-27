// Multi-bay reservations (approved model: a `bayReservations` collection). Pure: no Firestore.
//
// A booking holds each bay it needs for a scheduled stage through its own reservation, owned by the SERVICE LINE that
// needs it. Releasing one line's reservations therefore can never release a bay another retained line still needs.
// Reservation ids are deterministic (booking + line + stage), so a retried booking transaction can never create a
// duplicate, and creating them all inside the booking transaction makes the set atomic (all or none).
// Preparation is staff-managed and never reserved (S1c). No fee, refund or cancellation policy lives here: per-service
// cancellation is NOT enabled anywhere until an explicit cancellation/refund policy is approved.
import { TURNOVER_BUFFER_MINUTES } from "./constants.js";
import { collectionEstimate, type OccupancyInterval } from "./occupancy.js";
import type { BayType } from "./types/index.js";
import type { VisitPlan } from "./visit-plan.js";

export type BayReservationStatus = "active" | "released";

/** A booked job whose bays are held by stage reservations, while its car has not arrived: its planned occupancy is its
 *  reservations ONLY. Its own scheduled window spans the whole visit, so counting it would wrongly block its first bay.
 *  Once the car arrives, the ordinary physical-hold rule applies to the bay it is in. */
export function isReservationBackedPending(job: { status: string; bayReservationIds?: readonly string[] | null | undefined }): boolean {
  return job.status === "PENDING_VEHICLE" && Array.isArray(job.bayReservationIds) && job.bayReservationIds.length > 0;
}

export interface BayReservation {
  id: string;
  tenantId: string;
  studioId: string;
  bookingId: string;
  jobId: string;
  /** The service line that owns this reservation. */
  serviceId: string;
  /** Position of the stage within its service line (0-based). */
  stageIndex: number;
  bayId: string;
  bayType: BayType;
  /** Scheduled work window [startAt, endAt). */
  startAt: string;
  endAt: string;
  /** endAt + the existing 15-minute turnover: the bay is planned-occupied until here. */
  blockedUntil: string;
  status: BayReservationStatus;
  createdAt: string;
  releasedAt: string | null;
  releasedBy: string | null;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Deterministic reservation id for one stage of one service line of one booking. */
export function bayReservationId(bookingId: string, serviceId: string, stageIndex: number): string {
  if (!SAFE_ID.test(bookingId) || !SAFE_ID.test(serviceId) || !Number.isSafeInteger(stageIndex) || stageIndex < 0) {
    throw new RangeError("Exact booking, service and stage identity required for a bay reservation.");
  }
  return `${bookingId}__${serviceId}__${stageIndex}`;
}

/** One active reservation per scheduled stage of the plan, owned by its service line. */
export function reservationsFromPlan(plan: VisitPlan, ctx: { tenantId: string; studioId: string; bookingId: string; jobId: string; createdAt: string }): BayReservation[] {
  return plan.lines.flatMap((line) => line.stages.map((stage, stageIndex): BayReservation => {
    const blocked = Date.parse(stage.blockedUntil), end = Date.parse(stage.endAt);
    if (!Number.isFinite(blocked) || !Number.isFinite(end) || blocked - end !== TURNOVER_BUFFER_MINUTES * 60_000) {
      throw new RangeError(`Stage ${stageIndex} of ${line.serviceId} does not carry the ${TURNOVER_BUFFER_MINUTES}-minute turnover.`);
    }
    return {
      id: bayReservationId(ctx.bookingId, line.serviceId, stageIndex),
      tenantId: ctx.tenantId, studioId: ctx.studioId, bookingId: ctx.bookingId, jobId: ctx.jobId,
      serviceId: line.serviceId, stageIndex, bayId: stage.bayId, bayType: stage.resource,
      startAt: stage.startAt, endAt: stage.endAt, blockedUntil: stage.blockedUntil,
      status: "active", createdAt: ctx.createdAt, releasedAt: null, releasedBy: null,
    };
  }));
}

/** Planned-occupancy windows of the ACTIVE reservations, per bay ([startAt, blockedUntil), turnover included).
 *  `exceptBookingId` skips the caller's own booking (rescheduling it). Throws on a malformed window. */
export function activeReservationIntervals(reservations: readonly BayReservation[], exceptBookingId?: string): Map<string, OccupancyInterval[]> {
  const out = new Map<string, OccupancyInterval[]>();
  for (const r of reservations) {
    if (r.status !== "active" || (exceptBookingId !== undefined && r.bookingId === exceptBookingId)) continue;
    const startMs = Date.parse(r.startAt), endMs = Date.parse(r.blockedUntil);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) throw new RangeError(`Invalid reservation window ${r.id}.`);
    out.set(r.bayId, [...(out.get(r.bayId) ?? []), { startMs, endMs }]);
  }
  return out;
}

/** Ids of the ACTIVE reservations owned by these service lines of this booking: never another line's, never another
 *  booking's. Supports independent line handling; it applies no fee, refund or cancellation policy. */
export function reservationsToRelease(reservations: readonly BayReservation[], bookingId: string, serviceIds: readonly string[]): string[] {
  const lines = new Set(serviceIds);
  return reservations.filter((r) => r.status === "active" && r.bookingId === bookingId && lines.has(r.serviceId)).map((r) => r.id);
}

export interface ServiceLineProgress {
  serviceId: string;
  status: string;
  /** Estimated completion of this line's scheduled main work. */
  estimatedCompletionAt: string;
}

/** Collection estimate derived on read: the latest estimated completion among retained lines, excluding CANCELLED and
 *  DELIVERED lines. Scheduled main work only (preparation is staff-managed and not scheduled). Null when no line is
 *  retained. Never stored, so it cannot go stale. */
export function collectionEstimateOnRead(lines: readonly ServiceLineProgress[]): string | null {
  return collectionEstimate(lines.map((l) => ({ estimatedEndAt: l.estimatedCompletionAt, retained: l.status !== "CANCELLED" && l.status !== "DELIVERED" })));
}
