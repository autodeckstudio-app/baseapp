import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, ServiceJob, Membership } from "@autodeck/core";
import { CANCELLATION_FREE_WINDOW_HOURS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { cancelBookingSchema } from "../../schemas/booking.js";

export const cancelBooking = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(cancelBookingSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.cancel");

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

  await db.runTransaction(async (tx) => {
    // All reads before any writes. Find the associated job INSIDE the
    // transaction (Phase 5B P1-3 fix) — this was previously a plain query
    // fetched before the transaction started, then its stale snapshot's
    // job.status and job.statusHistory were used both to decide
    // cancel-eligibility and to build the new statusHistory array. A
    // concurrent advanceJobStatus call landing between that outer read and
    // this transaction's commit would have its transition silently
    // overwritten (statusHistory is a full-array replace) and could let a
    // job that has since moved out of the cancellable window get cancelled
    // anyway, since the eligibility check ran against stale data. Fetching
    // via tx.get() makes Firestore's transaction conflict detection cover
    // this read, so a genuinely concurrent status change causes a retry
    // against fresh data instead of a silent overwrite.
    const jobsSnap = await tx.get(
      db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(1),
    );

    // Restore the membership wash credit if one was consumed by this
    // booking — doc07 §7.9 step 3. Discount-type usage is NOT reversed
    // (docs are silent; treated as historical fact, matching the
    // append-only MembershipUsage record, which has no reversal field).
    const membershipRef = booking.membershipId
      ? db.collection(COLLECTIONS.memberships()).doc(booking.membershipId)
      : null;
    const membershipSnap = membershipRef ? await tx.get(membershipRef) : null;

    // Financial integrity guard: no refund/recharge model exists for
    // cancelling a booking that already has a payment in flight or settled
    // (same architectural boundary createApproval.ts already enforces for
    // additional-work requests — see that file's comment). Without this,
    // a job could be cancelled while paid/pending, then still get its
    // payment manually confirmed afterward, invoicing cancelled work
    // (Phase 6 hostile-audit finding).
    const jobsForPaymentCheck = !jobsSnap.empty
      ? await tx.get(
          db
            .collection(COLLECTIONS.payments())
            .where("jobId", "==", jobsSnap.docs[0]?.id ?? "")
            .where("status", "in", ["pending", "processing", "completed"])
            .limit(1),
        )
      : null;
    if (jobsForPaymentCheck && !jobsForPaymentCheck.empty) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot cancel a booking once payment has been initiated or completed for its job. Contact the studio to resolve payment first.",
      );
    }

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
