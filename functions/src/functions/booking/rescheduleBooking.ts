import { assertNotPriorityHeld } from "../../lib/priority-access.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, StudioConfig, Service } from "@autodeck/core";
import {
  isBookingMissed,
  rescheduleRule,
} from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, extractUser, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { rescheduleBookingSchema } from "../../schemas/booking.js";
import { runRescheduleMove } from "../../lib/reschedule-move.js";
import { localToUTC, computeScheduleEnd } from "../../lib/schedule.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const rescheduleBooking = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request): Promise<{ booking: Booking }> => {
  const data = validate(rescheduleBookingSchema, request.data);
  const user = data.customerContext ? extractCustomerUser(request) : extractUser(request);
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

  const missed = isBookingMissed(booking);

  // Customer reschedule rules (doc07 §7.8)
  // A missed booking (start time passed, car never came) can always be moved to a new future time.
  const [serviceSnap, configSnap] = await Promise.all([
    db.collection(COLLECTIONS.services()).doc(booking.serviceId).get(),
    db.collection(COLLECTIONS.studioConfig()).doc(booking.studioId).get(),
  ]);
  if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
  if (!configSnap.exists) throw new HttpsError("not-found", "Studio not found.");

  const service = serviceSnap.data() as Service;

  // Category-aware customer rules (basket item 6): wash services get one free
  // move up to 4 hours ahead; every other category keeps the legacy 2/24h
  // rule until the premium request-and-approve flow is reviewed and activated.
  const rule = rescheduleRule(service.category);
  if (isCustomer && !missed) {
    if (booking.rescheduleCount >= rule.maxCount) {
      throw new HttpsError(
        "failed-precondition",
        `Maximum reschedules (${rule.maxCount}) reached. Contact the studio to reschedule.`,
      );
    }
    const scheduledAt = new Date(booking.scheduledAt);
    const hoursUntil = (scheduledAt.getTime() - Date.now()) / 3600000;
    if (hoursUntil < rule.cutoffHours) {
      throw new HttpsError(
        "failed-precondition",
        `Reschedules within ${rule.cutoffHours} hours of the appointment must be made by contacting the studio directly.`,
      );
    }
  }

  // The whole visit (primary plus extras) is what holds the bay, so use the minutes saved at booking time, not the primary service alone.
  const visitMinutes = booking.durationMinutes || service.estimatedDurationMinutes;
  const config = configSnap.data() as StudioConfig;
  assertTenant(user, service.tenantId);
  assertTenant(user, config.tenantId);
  if (!service.active) throw new HttpsError("failed-precondition", "Service is not currently available.");

  const newStart = localToUTC(data.newDate, data.newTime, config.timezone);
  if (newStart <= new Date()) {
    throw new HttpsError("invalid-argument", "New booking time must be in the future.");
  }

  await assertNotPriorityHeld(db, { isCustomer, customerId: booking.customerId, date: data.newDate, time: data.newTime, serviceDurationMinutes: visitMinutes, config, now: new Date() });

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
    visitMinutes,
    config.operatingHours,
    config.holidays,
    config.timezone,
  );
  const updatedBooking = await runRescheduleMove(db, user, booking, config, compatibleBays, {
    bookingId: data.bookingId,
    newDate: data.newDate,
    newTime: data.newTime,
    newStart,
    newEstimatedEndAt,
    visitMinutes,
    missed,
    auditAction: "booking.rescheduled",
  });

  return { booking: updatedBooking as Booking };
});
