import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, ServiceJob } from "@autodeck/core";
import { cancellationTerms } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, extractUser, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { cancelBookingSchema } from "../../schemas/booking.js";
import { runCancel } from "./adminCancelBooking.js";
import { readCancelReads, writeCancelRestores } from "../../lib/cancel-booking.js";

export const cancelBooking = onCall({ region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"] }, async (request) => {
  const data = validate(cancelBookingSchema, request.data);
  const user = data.customerContext ? extractCustomerUser(request) : extractUser(request);
  await enforceRateLimit(subjectFrom(user), "booking.cancel");

  const db = getFirestore();

  const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).get();
  if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = bookingSnap.data() as Booking;

  assertTenant(user, booking.tenantId);

  // Customers can only cancel their own bookings
  const isCustomer = user.claims.role === "customer";
  // Cancelling for a customer is admin-only for now (owner decision). Studio staff do not get a cancel here.
  const isStudioOrAbove = user.claims.role === "admin" || user.claims.role === "superadmin";

  if (isCustomer && booking.customerId !== user.uid) {
    throw new HttpsError("permission-denied", "Cannot cancel another customer's booking.");
  }
  if (!isCustomer && !isStudioOrAbove) {
    throw new HttpsError("permission-denied", "Unauthorized.");
  }
  // Phase 5B P1-14 fix — previously not checked at all here, letting a
  // studio employee at Studio A cancel a booking belonging to Studio B in
  // the same tenant.
  assertStudio(user, booking.studioId, "Booking");

  // Customers use the shared cancel path: later-day bookings only, policy fee, real refund through Razorpay, credits back.
  if (isCustomer) return runCancel(user, { bookingId: data.bookingId, reason: data.reason, feeAction: "charge" }, "customer");

  // Only the new unresolved LINK path enters shared waiting logic for legacy admin cancellation.
  if (isStudioOrAbove) {
    const js = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(1).get();
    const ps = js.empty ? null : await db.collection(COLLECTIONS.payments()).where("jobId", "==", js.docs[0]!.id).where("status", "in", ["pending", "processing"]).get();
    if (booking.cancelIntent?.state === "waiting" || booking.cancelIntent?.state === "needs_review" || ps?.docs.some(d => d.data()["method"] === "razorpay_payment_link")) return runCancel(user, { bookingId: data.bookingId, reason: data.reason, feeAction: "charge" }, "admin");
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

  // Customers can cancel up to the start. Inside the free window a fee applies (cancellation-policy.ts); it is recorded on the booking and the studio settles it. No money moves here.
  // The fee also applies after studio close (a missed visit cancelled late costs the normal tier fee).
  let cancellationFeePaise = 0;
  if (isCustomer) {
    let categories = (booking as { cancelCategories?: string[] }).cancelCategories ?? [];
    if (!categories.length) {
      const svcSnap = await db.collection(COLLECTIONS.services()).doc(booking.serviceId).get();
      categories = svcSnap.exists ? [String((svcSnap.data() as { category?: string }).category ?? "")] : [];
    }
    cancellationFeePaise = cancellationTerms({ categories, totalPaise: booking.totalAmount, scheduledAtMs: new Date(booking.scheduledAt).getTime(), nowMs: Date.now() }).feePaise;
  }

  const now = new Date().toISOString();
  const bookingRef = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);

  const outcome = await db.runTransaction(async (tx) => {
    // Re-read the booking inside the transaction: a second tap, a studio cancel or the close-time auto-cancel
    // landing at the same moment must not restore a credit twice.
    const freshSnap = await tx.get(bookingRef);
    const fresh = freshSnap.data() as Booking | undefined;
    if (!fresh) throw new HttpsError("not-found", "Booking not found.");
    if (fresh.status === "CANCELLED") return { alreadyCancelled: true };
    if (fresh.status === "COMPLETED" || fresh.status === "EXPIRED") {
      throw new HttpsError("failed-precondition", `Cannot cancel a booking with status ${fresh.status}.`);
    }
    const jobsSnap = await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(1));
    const paymentsOnJob = !jobsSnap.empty
      ? await tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", jobsSnap.docs[0]?.id ?? "").where("status", "in", ["pending", "processing", "completed"]).limit(10))
      : null;
    // Money already taken, or being taken, needs an admin to settle it (adminCancelBooking). A payment that was only started (pending) holds no money, so it is simply closed.
    if (paymentsOnJob && paymentsOnJob.docs.some((d) => d.data()["status"] !== "pending")) {
      throw new HttpsError("failed-precondition", "This booking has a payment on it. Please contact the studio to cancel it and arrange any refund.");
    }
    const reads = await readCancelReads(tx, db, fresh, data.bookingId);

    const cancellableStatuses: string[] = ["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED"];
    const jobDoc = jobsSnap.docs[0];
    const job = jobDoc ? (jobDoc.data() as ServiceJob) : null;
    // Work already started: a customer cannot cancel online and the advance is not refunded. The studio handles it.
    if (job && !cancellableStatuses.includes(job.status)) {
      throw new HttpsError("failed-precondition", isCustomer ? "Work on your car has already started. Please contact the studio." : "Work has already started on this job, so the booking cannot be cancelled here.");
    }

    for (const p of paymentsOnJob?.docs ?? []) tx.update(p.ref, { status: "cancelled", updatedAt: now });
    writeCancelRestores(tx, reads, fresh, data.bookingId, user, now, `Booking cancelled: ${data.bookingId}`);
    tx.update(bookingRef, {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledBy: isCustomer ? "customer" : "admin",
      cancellationReason: data.reason,
      cancellationFeePaise,
      ...(cancellationFeePaise > 0 ? { cancellationFeeStatus: "due" } : {}),
      updatedAt: now,
    });
    if (jobDoc && job) {
      tx.update(jobDoc.ref, {
        status: "CANCELLED",
        statusHistory: [...job.statusHistory, { status: "CANCELLED", changedAt: now, changedBy: user.uid, notes: `Booking cancelled: ${data.reason}` }],
        updatedAt: now,
      });
    }
    writeAuditLog(tx, {
      action: "booking.cancelled",
      entityType: "Booking",
      entityId: data.bookingId,
      user,
      studioId: booking.studioId,
      before: { status: fresh.status },
      after: { status: "CANCELLED", cancellationReason: data.reason, cancellationFeePaise },
    });
    return { alreadyCancelled: false };
  });

  return outcome.alreadyCancelled ? { success: true, alreadyCancelled: true } : { success: true };
});
