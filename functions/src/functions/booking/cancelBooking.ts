import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, ServiceJob, Membership } from "@autodeck/core";
import { CANCELLATION_FREE_WINDOW_HOURS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { cancelBookingSchema } from "../../schemas/booking.js";

export const cancelBooking = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(cancelBookingSchema, request.data);

  const db = getFirestore();

  const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).get();
  if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = bookingSnap.data() as Booking;

  assertTenant(user, booking.tenantId);

  // Customers can only cancel their own bookings
  const isCustomer = user.claims.role === "customer";
  const isStudioOrAbove =
    user.claims.role === "studio" ||
    user.claims.role === "admin" ||
    user.claims.role === "superadmin";

  if (isCustomer && booking.customerId !== user.uid) {
    throw new HttpsError("permission-denied", "Cannot cancel another customer's booking.");
  }
  if (!isCustomer && !isStudioOrAbove) {
    throw new HttpsError("permission-denied", "Unauthorized.");
  }

  if (booking.status === "CANCELLED") {
    return { success: true, alreadyCancelled: true };
  }
  if (booking.status === "COMPLETED" || booking.status === "EXPIRED") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot cancel a booking with status ${booking.status}.`,
    );
  }

  // Customers cannot cancel within 24h of the scheduled time
  if (isCustomer) {
    const scheduledAt = new Date(booking.scheduledAt);
    const hoursUntil = (scheduledAt.getTime() - Date.now()) / 3600000;
    if (hoursUntil < CANCELLATION_FREE_WINDOW_HOURS) {
      throw new HttpsError(
        "failed-precondition",
        `Cancellations within ${CANCELLATION_FREE_WINDOW_HOURS} hours of the appointment must be made by contacting the studio directly.`,
      );
    }
  }

  const now = new Date().toISOString();
  const bookingRef = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);

  // Find the associated job
  const jobsSnap = await db
    .collection(COLLECTIONS.jobs())
    .where("bookingId", "==", data.bookingId)
    .limit(1)
    .get();

  await db.runTransaction(async (tx) => {
    // All reads before any writes. Restore the membership wash credit if one
    // was consumed by this booking — doc07 §7.9 step 3. Discount-type usage
    // is NOT reversed (docs are silent; treated as historical fact, matching
    // the append-only MembershipUsage record, which has no reversal field).
    const membershipRef = booking.membershipId
      ? db.collection(COLLECTIONS.memberships()).doc(booking.membershipId)
      : null;
    const membershipSnap = membershipRef ? await tx.get(membershipRef) : null;

    tx.update(bookingRef, {
      status: "CANCELLED",
      cancelledAt: now,
      cancellationReason: data.reason,
      updatedAt: now,
    });

    if (booking.membershipWashUsed && membershipRef && membershipSnap?.exists) {
      const membership = membershipSnap.data() as Membership;
      tx.update(membershipRef, {
        washesUsed: Math.max(0, membership.washesUsed - 1),
        updatedAt: now,
      });
      writeAuditLog(tx, {
        action: "membership.wash_restored",
        entityType: "Membership",
        entityId: booking.membershipId as string,
        user,
        studioId: booking.studioId,
        before: { washesUsed: membership.washesUsed },
        after: { washesUsed: Math.max(0, membership.washesUsed - 1), reason: `Booking cancelled: ${data.bookingId}` },
      });
    }

    // Cancel the associated job if it hasn't progressed past VEHICLE_RECEIVED
    if (!jobsSnap.empty) {
      const jobDoc = jobsSnap.docs[0];
      if (!jobDoc) {
        // no-op
      } else {
        const job = jobDoc.data() as ServiceJob;
        const cancellableStatuses: string[] = ["PENDING_VEHICLE", "VEHICLE_RECEIVED"];
        if (cancellableStatuses.includes(job.status)) {
          tx.update(db.collection(COLLECTIONS.jobs()).doc(jobDoc.id), {
            status: "CANCELLED",
            statusHistory: [
              ...job.statusHistory,
              {
                status: "CANCELLED",
                changedAt: now,
                changedBy: user.uid,
                notes: `Booking cancelled: ${data.reason}`,
              },
            ],
            updatedAt: now,
          });
        }
      }
    }

    writeAuditLog(tx, {
      action: "booking.cancelled",
      entityType: "Booking",
      entityId: data.bookingId,
      user,
      studioId: booking.studioId,
      before: { status: booking.status },
      after: { status: "CANCELLED", cancellationReason: data.reason },
    });
  });

  return { success: true };
});
