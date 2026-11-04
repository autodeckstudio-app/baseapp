import {hasReleasedBay} from "@autodeck/core";
// Shared transactional reschedule move (basket item 6, stage 2).
// Extracted from rescheduleBooking so the premium approve path moves the
// booking with the SAME capacity, freshness and money semantics - not a
// staff bypass and not a copy. The whole body runs in one transaction:
// the new slot is acquired (capacity re-validated against live occupancy)
// before the old one is released, and any failure rolls back everything.
// Payment/advance fields are never in the update set, so an approved move
// cannot duplicate or alter a payment.
import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore } from "firebase-admin/firestore";
import type { Booking, ServiceJob, StudioConfig, AuditAction } from "@autodeck/core";
import { MAX_SERVICE_SPAN_DAYS } from "@autodeck/core";
import type { AuthorizedUser } from "@autodeck/auth";
import { COLLECTIONS } from "@autodeck/database";
import { writeAuditLog } from "../middleware/audit.js";
import { buildOccupiedInterval, generateDaySlots, type OccupiedInterval } from "./availability.js";
import { utcToLocalDate, utcToLocalTime, addDays } from "./schedule.js";

export type RescheduleMoveParams = {
  bookingId: string;
  newDate: string;
  newTime: string;
  newStart: Date;
  newEstimatedEndAt: Date;
  visitMinutes: number;
  /** Missed-booking moves do not consume a reschedule (existing rule). */
  missed: boolean;
  auditAction: AuditAction;
  auditExtra?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  /** Extra booking fields merged into the same update (e.g. request state). */
  extraBookingUpdates?: Partial<Booking>;
  /** Extra freshness predicate run on the in-transaction re-read; throw to abort. */
  extraFreshnessCheck?: (freshBooking: Booking) => void;
};

export async function runRescheduleMove(
  db: Firestore,
  user: AuthorizedUser,
  booking: Booking,
  config: StudioConfig,
  compatibleBays: StudioConfig["bays"],
  params: RescheduleMoveParams,
): Promise<Booking> {
  const now = new Date().toISOString();

  return db.runTransaction(async (tx) => {
    // All reads before any writes. Re-read the booking inside the transaction
    // (see rescheduleBooking: concurrent changes must conflict, not overwrite).
    const freshBookingSnap = await tx.get(db.collection(COLLECTIONS.bookings()).doc(params.bookingId));
    const freshBooking = freshBookingSnap.data() as Booking | undefined;
    if (!freshBooking || freshBooking.status !== "CONFIRMED" || freshBooking.scheduledAt !== booking.scheduledAt || freshBooking.rescheduleCount !== booking.rescheduleCount) {
      throw new HttpsError("failed-precondition", "Booking changed. Reload it before rescheduling.");
    }
    params.extraFreshnessCheck?.(freshBooking);

    const jobsSnap = await tx.get(
      db.collection(COLLECTIONS.jobs()).where("bookingId", "==", params.bookingId).limit(1),
    );
    const jobDoc = jobsSnap.docs[0];
    if (jobDoc && (jobDoc.data() as ServiceJob).status !== "PENDING_VEHICLE") {
      throw new HttpsError("failed-precondition", "The vehicle has already arrived. Reload the job.");
    }

    // Re-validate availability for the new slot inside the transaction,
    // widened to a MAX_SERVICE_SPAN_DAYS range for multi-day jobs.
    const rangeStartDate = addDays(params.newDate, -MAX_SERVICE_SPAN_DAYS);
    const rangeEndDate = addDays(params.newDate, MAX_SERVICE_SPAN_DAYS);
    const bayOccupancy = new Map<string, OccupiedInterval[]>();
    for (const bay of compatibleBays) {
      const jobsOnBay = await tx.get(
        db
          .collection(COLLECTIONS.jobs())
          .where("studioId", "==", booking.studioId)
          .where("bayId", "==", bay.id)
          .where("scheduledDate", ">=", rangeStartDate)
          .where("scheduledDate", "<=", rangeEndDate),
      );
      const intervals: OccupiedInterval[] = [];
      for (const doc of jobsOnBay.docs) {
        const j = doc.data() as ServiceJob;
        // Exclude the current booking's own job from conflict check
        if (j.bookingId === params.bookingId) continue;
        if (hasReleasedBay(j)||j.status === "CANCELLED" || j.status === "DELIVERED") continue;
        intervals.push(buildOccupiedInterval(j.scheduledAt, j.estimatedEndAt));
      }
      bayOccupancy.set(bay.id, intervals);
    }

    let assignedBayId: string | null = null;
    let minJobs = Infinity;
    for (const bay of compatibleBays) {
      const occupied = bayOccupancy.get(bay.id) ?? [];
      const localDay = new Date(`${params.newDate}T12:00:00Z`).getUTCDay();
      const hours = config.operatingHours.find(h => h.dayOfWeek === localDay);
      const offered = hours && !hours.closed && !config.holidays.includes(params.newDate) ? generateDaySlots({
        date: params.newDate, openTime: hours.open, closeTime: hours.close,
        serviceDurationMinutes: params.visitMinutes, occupiedIntervals: occupied,
        timezone: config.timezone, operatingHours: config.operatingHours, holidays: config.holidays,
      }) : [];
      if (offered.some(slot => slot.startAt === params.newStart.toISOString())) {
        if (occupied.length < minJobs) {
          minJobs = occupied.length;
          assignedBayId = bay.id;
        }
      }
    }
    if (!assignedBayId) {
      throw new HttpsError(
        "resource-exhausted",
        "No bays available for the new time slot. Please choose another time.",
      );
    }

    // Schedule-only update set: payment, advance, quote and money fields are
    // never touched, so the move cannot duplicate or alter a payment.
    const bookingUpdates: Partial<Booking> = {
      scheduledAt: params.newStart.toISOString(),
      scheduledDate: params.newDate,
      scheduledTime: params.newTime,
      estimatedEndAt: params.newEstimatedEndAt.toISOString(),
      estimatedEndDate: utcToLocalDate(params.newEstimatedEndAt, config.timezone),
      estimatedEndTime: utcToLocalTime(params.newEstimatedEndAt, config.timezone),
      bayId: assignedBayId,
      rescheduleCount: booking.rescheduleCount + (params.missed ? 0 : 1),
      missedAt: null,
      missedForScheduledAt: null,
      updatedAt: now,
      ...params.extraBookingUpdates,
    };

    tx.update(db.collection(COLLECTIONS.bookings()).doc(params.bookingId), bookingUpdates);

    if (jobDoc) {
      const job = jobDoc.data() as ServiceJob;
      tx.update(db.collection(COLLECTIONS.jobs()).doc(jobDoc.id), {
        scheduledAt: params.newStart.toISOString(),
        scheduledDate: params.newDate,
        // Buffer-free — same instant as the booking update above.
        estimatedEndAt: params.newEstimatedEndAt.toISOString(),
        estimatedEndDate: utcToLocalDate(params.newEstimatedEndAt, config.timezone),
        bayId: assignedBayId,
        statusHistory: [
          ...job.statusHistory,
          {
            status: job.status,
            changedAt: now,
            changedBy: user.uid,
            notes: `Rescheduled to ${params.newDate} ${params.newTime}`,
          },
        ],
        updatedAt: now,
      });
    }

    writeAuditLog(tx, {
      action: params.auditAction,
      entityType: "Booking",
      entityId: params.bookingId,
      user,
      studioId: booking.studioId,
      before: {
        scheduledAt: booking.scheduledAt,
        bayId: booking.bayId,
        rescheduleCount: booking.rescheduleCount,
        ...params.auditExtra?.before,
      },
      after: {
        scheduledAt: params.newStart.toISOString(),
        bayId: assignedBayId,
        rescheduleCount: booking.rescheduleCount + (params.missed ? 0 : 1),
        ...params.auditExtra?.after,
      },
    });

    return { ...booking, ...bookingUpdates } as Booking;
  });
}
