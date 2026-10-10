// DEV/EMULATOR ONLY: Simulates a payment provider webhook internally.
// Allows testing the full payment â invoice flow without a real provider.
// Gated: only runs when FUNCTIONS_EMULATOR=true or USE_PAYMENT_MOCK=true,
// AND (Phase 5B P1-11 defense-in-depth) never in the actual production
// Firebase project regardless of those env vars â a single misconfigured
// env var (accidentally copied from a dev/staging config, or left set after
// manual prod testing) must not be sufficient on its own to let any
// studio/admin mark an arbitrary payment "completed" without a real payment
// ever occurring.
//
// Operates on the Payment's jobId (always populated) rather than bookingId,
// so it confirms a customer-initiated payment identically whether the
// underlying job came from a booking or a walk-in.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment, ServiceJob, Membership } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { confirmPaymentMockSchema } from "../../schemas/payment.js";
import { MEMBERSHIP_DURATION_DAYS } from "@autodeck/core";
import { prepareJobInvoice } from "../../lib/job-invoice.js";
import { isProductionProject } from "../../lib/environment.js";

export const confirmPaymentMock = onCall({ region: "asia-south1" }, async (request) => {
  const isEmulator =
    process.env["FUNCTIONS_EMULATOR"] === "true" || process.env["USE_PAYMENT_MOCK"] === "true";

  if (!isEmulator || isProductionProject()) {
    throw new HttpsError(
      "failed-precondition",
      "confirmPaymentMock is only available in emulator/dev environments.",
    );
  }

  const user = extractUser(request);
  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Studio or admin role required.");
  }

  const data = validate(confirmPaymentMockSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.confirmMock");

  const db = getFirestore();
  const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(data.paymentId).get();
  if (!paymentSnap.exists) throw new HttpsError("not-found", "Payment not found.");

  const payment = paymentSnap.data() as Payment;

  if (payment.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  // studioId is null for membership-purchase payments (not studio-scoped) â
  // only enforce the boundary when the payment actually belongs to a studio
  // (Phase 5B P1-14 fix â previously not checked at all here).
  if (payment.studioId) {
    assertStudio(user, payment.studioId, "Payment");
  }

  // Idempotency check comes BEFORE the terminal-state guard: a redelivered
  // webhook event for a payment that already finished processing must return
  // gracefully, not error out just because the payment is no longer pending.
  const mockEventId = `mock_${data.paymentId}_${data.mockResult}`;
  const eventRef = db.collection(COLLECTIONS.paymentEvents()).doc(mockEventId);
  const eventSnap = await eventRef.get();
  if (eventSnap.exists) {
    return { paymentId: data.paymentId, result: data.mockResult, idempotent: true };
  }

  if (payment.status !== "pending" && payment.status !== "processing") {
    throw new HttpsError(
      "failed-precondition",
      `Payment is already in terminal state: ${payment.status}`,
    );
  }

  const now = new Date().toISOString();
  const isSuccess = data.mockResult === "success";

  await db.runTransaction(async (tx) => {
    // All reads must happen before any writes within a Firestore transaction â
    // the event-idempotency write is deferred until after the reads below.
    if (isSuccess && payment.targetType === "membership") {
      // Membership purchase paid online: the backend has now verified the
      // payment, so activate the membership immediately in the same
      // transaction â the customer must not wait for staff approval, and an
      // unverified payment must never grant benefits. Idempotent via the
      // paymentEvents guard above and the pending-status check below.
      const membershipRef = payment.membershipId
        ? db.collection(COLLECTIONS.memberships()).doc(payment.membershipId)
        : null;
      const membershipSnap = membershipRef ? await tx.get(membershipRef) : null;

      tx.set(eventRef, { paymentId: data.paymentId, result: data.mockResult, processedAt: now });
      tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
        status: "completed",
        razorpayPaymentId: `mock_pay_${Date.now()}`,
        completedAt: now,
        updatedAt: now,
      });
      writeAuditLog(tx, {
        action: "payment.completed",
        entityType: "Payment",
        entityId: data.paymentId,
        user,
        studioId: null,
        after: { status: "completed", targetType: "membership", membershipId: payment.membershipId },
      });

      if (membershipRef && membershipSnap?.exists) {
        const membership = membershipSnap.data() as Membership;
        if (membership.status === "pending") {
          const startDate = now.slice(0, 10);
          const endDate = new Date(Date.parse(now) + MEMBERSHIP_DURATION_DAYS * 86400000)
            .toISOString()
            .slice(0, 10);
          tx.update(membershipRef, {
            status: "active",
            startDate,
            endDate,
            activatedAt: now,
            activatedBy: "system",
            updatedAt: now,
          });
          writeAuditLog(tx, {
            action: "membership.activated",
            entityType: "Membership",
            entityId: membershipRef.id,
            user,
            studioId: null,
            before: { status: membership.status },
            after: { status: "active", startDate, endDate, via: "payment_verified" },
          });
        }
      }
      return;
    }

    if (isSuccess) {
      if (!payment.jobId) throw new HttpsError("failed-precondition", "Payment has no linked job.");

      const jobSnap = await tx.get(db.collection(COLLECTIONS.jobs()).doc(payment.jobId));
      if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
      const job = jobSnap.data() as ServiceJob;

      // Guard against the job having moved out from under this payment
      // since it was initiated â same defense-in-depth check
      // confirmManualPayment.ts already has (Phase 5B P1-8 fix â this file
      // had no equivalent, so a duplicate payment reaching this success
      // path twice would issue two invoices for one job).
      if (job.paymentStatus === "paid") {
        throw new HttpsError("already-exists", "This job has already been marked as paid.");
      }
      if (job.status === "CANCELLED") {
        throw new HttpsError("failed-precondition", "Cannot confirm payment for a cancelled job.");
      }

      // Allocate invoice number and build invoice atomically
      const prepared = await prepareJobInvoice(db, tx, job, data.paymentId);
      if (prepared.existing) {
        throw new HttpsError("already-exists", "An invoice already exists for this job.");
      }
      const { invoiceRef, invoice } = prepared;
      const invoiceNumber = invoice.invoiceNumber;

      // Mark event as processed (idempotency) â first write, now that all reads are done
      tx.set(eventRef, { paymentId: data.paymentId, result: data.mockResult, processedAt: now });

      // Update payment â completed
      tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
        status: "completed",
        razorpayPaymentId: `mock_pay_${Date.now()}`,
        invoiceId: invoiceRef.id,
        completedAt: now,
        updatedAt: now,
      });

      // Update job â paid
      tx.update(db.collection(COLLECTIONS.jobs()).doc(job.id), {
        paymentStatus: "paid",
        updatedAt: now,
      });

      // Sync linked booking, if any
      if (job.bookingId) {
        tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), {
          paymentStatus: "paid",
          updatedAt: now,
        });
      }

      // Write invoice
      tx.set(invoiceRef, invoice);

      writeAuditLog(tx, {
        action: "payment.completed",
        entityType: "Payment",
        entityId: data.paymentId,
        user,
        studioId: payment.studioId,
        after: { status: "completed", invoiceId: invoiceRef.id },
      });
      writeAuditLog(tx, {
        action: "invoice.issued",
        entityType: "Invoice",
        entityId: invoiceRef.id,
        user,
        studioId: payment.studioId,
        after: { invoiceNumber, total: invoice.total, status: "issued" },
      });
    } else if (payment.targetType === "membership" && payment.membershipId) {
      // Membership purchase payment failed: cancel the pending membership
      // rather than leaving it stuck in 'pending' forever (docs are silent on
      // this case â resolved by mirroring the booking auto-expiry pattern of
      // not leaving orphaned pending records around).
      const membershipRef = db.collection(COLLECTIONS.memberships()).doc(payment.membershipId);
      const membershipSnap = await tx.get(membershipRef);

      tx.set(eventRef, { paymentId: data.paymentId, result: data.mockResult, processedAt: now });
      tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
        status: "failed",
        failedAt: now,
        updatedAt: now,
      });
      writeAuditLog(tx, {
        action: "payment.failed",
        entityType: "Payment",
        entityId: data.paymentId,
        user,
        studioId: null,
        after: { status: "failed", targetType: "membership" },
      });

      if (membershipSnap.exists && (membershipSnap.data() as Membership).status === "pending") {
        tx.update(membershipRef, {
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: "system",
          cancellationReason: "payment_failed",
          updatedAt: now,
        });
        writeAuditLog(tx, {
          action: "membership.cancelled",
          entityType: "Membership",
          entityId: payment.membershipId,
          user,
          studioId: null,
          before: { status: "pending" },
          after: { status: "cancelled", reason: "payment_failed" },
        });
      }
    } else {
      // Payment failed â no reads in this branch, so the event write can go first.
      tx.set(eventRef, { paymentId: data.paymentId, result: data.mockResult, processedAt: now });
      tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
        status: "failed",
        failedAt: now,
        updatedAt: now,
      });

      writeAuditLog(tx, {
        action: "payment.failed",
        entityType: "Payment",
        entityId: data.paymentId,
        user,
        studioId: payment.studioId,
        after: { status: "failed" },
      });
    }
  });

  return { paymentId: data.paymentId, result: data.mockResult, idempotent: false };
});
