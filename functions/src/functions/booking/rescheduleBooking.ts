import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, StudioConfig, ServiceJob, Service } from "@autodeck/core";
import {
  MAX_CUSTOMER_RESCHEDULES,
  CANCELLATION_FREE_WINDOW_HOURS,
  TURNOVER_BUFFER_MINUTES,
} from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { rescheduleBookingSchema } from "../../schemas/booking.js";
import { buildOccupiedInterval, hasConflict, type OccupiedInterval } from "../../lib/availability.js";
import { localToUTC, utcToLocalDate, utcToLocalTime } from "../../lib/schedule.js";

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

  const newEstimatedEndAt = new Date(
    newStart.getTime() + service.estimatedDurationMinutes * 60000,
  );
  const now = new Date().toISOString();

  // Find the associated job
  const jobsSnap = await db
    .collection(COLLECTIONS.jobs())
    .where("bookingId", "==", data.bookingId)
    .limit(1)
    .get();
  const jobDoc = jobsSnap.docs[0];

  const updatedBooking = await db.runTransaction(async (tx) => {
    // Re-validate availability for the new slot inside the transaction
    const bayOccupancy = new Map<string, OccupiedInterval[]>();
    for (const bay of compatibleBays) {
      const jobsOnBay = await tx.get(
        db
          .collection(COLLECTIONS.jobs())
          .where("studioId", "==", booking.studioId)
          .where("bayId", "==", bay.id)
          .where("scheduledDate", "==", data.newDate),
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
      if (!hasConflict(newStart, service.estimatedDurationMinutes, occupied)) {
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
        estimatedEndAt: new Date(
          newStart.getTime() +
            (service.estimatedDurationMinutes + TURNOVER_BUFFER_MINUTES) * 60000,
        ).toISOString(),
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
