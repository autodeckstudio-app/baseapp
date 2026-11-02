// Premium reschedule REQUEST (basket item 6, premium half - PREVIEW, not activated).
// The customer asks for a new time on a premium (pay-at-studio) booking; an admin
// decides separately via decideBookingRescheduleRequest. This callable ONLY records
// the request: it never moves the slot, never touches payment/advance fields (so a
// duplicate payment is impossible by construction here), and the booking stays
// CONFIRMED at its original time. Guards (pure, unit-tested) live in
// ../../lib/reschedule-request.js.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { requestBookingRescheduleSchema } from "../../schemas/booking.js";
import { canRequestReschedule, isPremiumCategory } from "../../lib/reschedule-request.js";
import { localToUTC } from "../../lib/schedule.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const requestBookingReschedule = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const data = validate(requestBookingRescheduleSchema, request.data);
  const user = extractCustomerUser(request);
  await enforceRateLimit(subjectFrom(user), "booking.rescheduleRequest");

  if (user.claims.role !== "customer") {
    throw new HttpsError("permission-denied", "Only the customer can request a reschedule.");
  }

  const db = getFirestore();
  const bookingRef = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);

  return db.runTransaction(async (tx) => {
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = bookingSnap.data() as Booking;

    assertTenant(user, booking.tenantId);
    assertStudio(user, booking.studioId, "Booking");
    if (booking.customerId !== user.uid) {
      throw new HttpsError("permission-denied", "Cannot request a reschedule for another customer's booking.");
    }

    const serviceSnap = await tx.get(db.collection(COLLECTIONS.services()).doc(booking.serviceId));
    if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
    const service = serviceSnap.data() as Service;
    assertTenant(user, service.tenantId);
    if (!isPremiumCategory(service.category)) {
      throw new HttpsError("failed-precondition", "Reschedule requests apply to premium services only; this booking can be rescheduled directly.");
    }

    const configSnap = await tx.get(db.collection(COLLECTIONS.studioConfig()).doc(booking.studioId));
    if (!configSnap.exists) throw new HttpsError("not-found", "Studio not found.");
    const config = configSnap.data() as import("@autodeck/core").StudioConfig;

    const now = new Date();
    const guard = canRequestReschedule(booking, service.category, now);
    if (!guard.ok) throw new HttpsError(guard.code as never, guard.message);

    const requestedStart = localToUTC(data.newDate, data.newTime, config.timezone);
    if (requestedStart <= now) {
      throw new HttpsError("invalid-argument", "The requested new time must be in the future.");
    }

    // Idempotency: a retried submit with the same key returns the pending request unchanged.
    const existing = booking.rescheduleRequest;
    if (existing && existing.status === "pending") {
      return { booking };
    }

    const rescheduleRequest = {
      requestedDate: data.newDate,
      requestedTime: data.newTime,
      requestedAt: now.toISOString(),
      status: "pending" as const,
      note: data.note ?? null,
      baseScheduledAt: booking.scheduledAt,
    };

    // One request per booking: count submissions; the pending-retry path above
    // returns before this, so an idempotent retry never double-counts.
    const rescheduleRequestCount = (booking.rescheduleRequestCount ?? 0) + 1;
    tx.update(bookingRef, { rescheduleRequest, rescheduleRequestCount, updatedAt: now.toISOString() });

    writeAuditLog(tx, {
      action: "booking.reschedule_requested",
      entityType: "Booking",
      entityId: data.bookingId,
      user,
      studioId: booking.studioId,
      before: { scheduledAt: booking.scheduledAt, rescheduleRequest: existing ?? null },
      after: { rescheduleRequest, rescheduleRequestCount },
    });

    return { booking: { ...booking, rescheduleRequest, rescheduleRequestCount } as Booking };
  });
});
