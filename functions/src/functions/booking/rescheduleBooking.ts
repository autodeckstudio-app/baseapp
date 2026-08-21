import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, StudioConfig, ServiceJob, Service } from "@autodeck/core";
import {
  MAX_CUSTOMER_RESCHEDULES,
  CANCELLATION_FREE_WINDOW_HOURS,
  MAX_SERVICE_SPAN_DAYS,
} from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { rescheduleBookingSchema } from "../../schemas/booking.js";
import { buildOccupiedInterval, hasConflict, type OccupiedInterval } from "../../lib/availability.js";
import { localToUTC, utcToLocalDate, utcToLocalTime, addDays, computeScheduleEnd } from "../../lib/schedule.js";

export const rescheduleBooking = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(rescheduleBookingSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.reschedule");

  const db = getFirestore();
  const isCustomer = user.claims.role === "customer";
  const isStudioOrAbove =
    user.claims.role === "studio" ||
    user.claims.role === "admin" ||
    user.claims.role === "superadmin";

  const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).get();
  if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = bookingSnap.data() as Booking;

  assertTenant(user, booking.tenantId);

  if (isCustomer && booking.customerId !== user.uid) {
    throw new HttpsError("permission-denied", "Cannot reschedule another customer's booking.");
  }
  if (!isCustomer && !isStudioOrAbove) {
    throw new HttpsError("permission-denied", "Unauthorized.");
  }
  // Phase 5B P1-14 fix — previously not checked at all here, letting a
  // studio employee at Studio A reschedule a booking belonging to Studio B
  // in the same tenant.
  assertStudio(user, booking.studioId, "Booking");

  if (booking.status !== "CONFIRMED") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot reschedule a booking with status ${booking.status}.`,
    );
  }

  // Customer reschedule rules (doc07 §7.8)
  if (isCustomer) {
    if (booking.rescheduleCount >= MAX_CUSTOMER_RESCHEDULES) {
      throw new HttpsError(
        "failed-precondition",
        `Maximum reschedules (${MAX_CUSTOMER_RESCHEDULES}) reached. Contact the studio to reschedule.`,
      );
    }
    const scheduledAt = new Date(booking.scheduledAt);
    const hoursUntil = (scheduledAt.getTime() - Date.now()) / 3600000;
    if (hoursUntil < CANCELLATION_FREE_WINDOW_HOURS) {
      throw new HttpsError(
        "failed-precondition",
        `Reschedules within ${CANCELLATION_FREE_WINDOW_HOURS} hours of the appointment must be made by contacting the studio directly.`,
      );
    }
  }

  const [serviceSnap, configSnap] = await Promise.all([
    db.collection(COLLECTIONS.services()).doc(booking.serviceId).get(),
    db.collection(COLLECTIONS.studioConfig()).doc(booking.studioId).get(),
  ]);
  if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
  if (!configSnap.exists) throw new HttpsError("not-found", "Studio not found.");

  const service = serviceSnap.data() as Service;
  const config = configSnap.data() as StudioConfig;

  const newStart = localToUTC(data.newDate, data.newTime, config.timezone);
  if (newStart <= new Date()) {
    throw new HttpsError("invalid-argument", "New booking time must be in the future.");
  }

  const compatibleBays = config.bays.filter(
    (b) => b.active && b.bayType === service.requiredBayType,
  );
  if (compatibleBays.length === 0) {
    throw new HttpsError("failed-precondition", "No bays available for this service type.");
  }

  // Authoritative, multi-day-aware completion instant — identical
  // calculation to createBooking (single source of truth).
  const newEstimatedEndAt = computeScheduleEnd(
    newStart,
    service.estimatedDurationMinutes,
    config.operatingHours,
    config.holidays,
    config.timezone,
  );
  const now = new Date().toISOString();

  const updatedBooking = await db.runTransaction(async (tx) => {
    // All reads before any writes. Find the associated job INSIDE the
    // transaction (Phase 5B P1-4 fix) — this was previously a plain query
    // fetched before the transaction started, then its stale snapshot's
    // job.status/job.statusHistory were used to build the rescheduled job's
    // new statusHistory entry. A concurrent advanceJobStatus call landing
    // between that outer read and this transaction's commit would have its
    // transition silently dropped (statusHistory is a full-array replace).
    // Fetching via tx.get() makes Firestore's transaction conflict
    // detection cover this read, so a genuinely concurrent status change
    // causes a retry against fresh data instead of a silent overwrite.
    const jobsSnap = await tx.get(
      db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(1),
    );
    const jobDoc = jobsSnap.docs[0];

    // Re-validate availability for the new slot inside the transaction.
    // Widened to a MAX_SERVICE_SPAN_DAYS range so a multi-day job that
    // started earlier but is still occupying the bay is still found (Phase
    // 5 — multi-day booking).
    const rangeStartDate = addDays(data.newDate, -MAX_SERVICE_SPAN_DAYS);
    const rangeEndDate = addDays(data.newDate, MAX_SERVICE_SPAN_DAYS);
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
        if (j.bookingId === data.bookingId) continue;
        if (j.status === "CANCELLED" || j.status === "DELIVERED") continue;
        intervals.push(buildOccupiedInterval(j.scheduledAt, j.estimatedEndAt));
      }
      bayOccupancy.set(bay.id, intervals);
    }

    let assignedBayId: string | null = null;
    let minJobs = Infinity;
    for (const bay of compatibleBays) {
      const occupied = bayOccupancy.get(bay.id) ?? [];
      if (!hasConflict(newStart, newEstimatedEndAt, occupied)) {
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

    const bookingUpdates: Partial<Booking> = {
      scheduledAt: newStart.toISOString(),
      scheduledDate: data.newDate,
      scheduledTime: data.newTime,
      estimatedEndAt: newEstimatedEndAt.toISOString(),
      estimatedEndDate: utcToLocalDate(newEstimatedEndAt, config.timezone),
      estimatedEndTime: utcToLocalTime(newEstimatedEndAt, config.timezone),
      bayId: assignedBayId,
      rescheduleCount: booking.rescheduleCount + 1,
      updatedAt: now,
    };

    tx.update(db.collection(COLLECTIONS.bookings()).doc(data.bookingId), bookingUpdates);

    if (jobDoc) {
      const job = jobDoc.data() as ServiceJob;
      tx.update(db.collection(COLLECTIONS.jobs()).doc(jobDoc.id), {
        scheduledAt: newStart.toISOString(),
        scheduledDate: data.newDate,
        // Buffer-free — same instant as the booking update above.
        estimatedEndAt: newEstimatedEndAt.toISOString(),
        estimatedEndDate: utcToLocalDate(newEstimatedEndAt, config.timezone),
        bayId: assignedBayId,
        statusHistory: [
          ...job.statusHistory,
          {
            status: job.status,
            changedAt: now,
            changedBy: user.uid,
            notes: `Rescheduled to ${data.newDate} ${data.newTime}`,
          },
        ],
        updatedAt: now,
      });
    }

    writeAuditLog(tx, {
      action: "booking.rescheduled",
      entityType: "Booking",
      entityId: data.bookingId,
      user,
      studioId: booking.studioId,
      before: {
        scheduledAt: booking.scheduledAt,
        bayId: booking.bayId,
        rescheduleCount: booking.rescheduleCount,
      },
      after: {
        scheduledAt: newStart.toISOString(),
        bayId: assignedBayId,
        rescheduleCount: booking.rescheduleCount + 1,
      },
    });

    return { ...booking, ...bookingUpdates };
  });

  return { booking: updatedBooking };
});
