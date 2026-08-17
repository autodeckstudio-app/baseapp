// DEV/EMULATOR ONLY: Simulates a payment provider webhook internally.
// Allows testing the full payment → invoice flow without a real provider.
// Gated: only runs when FUNCTIONS_EMULATOR=true or USE_PAYMENT_MOCK=true.
//
// Operates on the Payment's jobId (always populated) rather than bookingId,
// so it confirms a customer-initiated payment identically whether the
// underlying job came from a booking or a walk-in.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment, ServiceJob, Membership } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { confirmPaymentMockSchema } from "../../schemas/payment.js";
import { allocateInvoiceNumber } from "../../lib/invoice-counter.js";
import { buildInvoice } from "../../lib/invoice-builder.js";

export const confirmPaymentMock = onCall({ region: "asia-south1" }, async (request) => {
  const isEmulator =
    process.env["FUNCTIONS_EMULATOR"] === "true" || process.env["USE_PAYMENT_MOCK"] === "true";

  if (!isEmulator) {
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

  const db = getFirestore();
  const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(data.paymentId).get();
  if (!paymentSnap.exists) throw new HttpsError("not-found", "Payment not found.");

  const payment = paymentSnap.data() as Payment;

  if (payment.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
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
    // All reads must happen before any writes within a Firestore transaction —
    // the event-idempotency write is deferred until after the reads below.
    if (isSuccess && payment.targetType === "membership") {
      // Membership purchase: mark the payment completed only. Activation is a
      // SEPARATE admin-only step (activateMembership) — payment succeeding
      // does not itself activate the membership (doc08 §8.2; doc16 §16.3).
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
      return;
    }

    if (isSuccess) {
      if (!payment.jobId) throw new HttpsError("failed-precondition", "Payment has no linked job.");

      const jobSnap = await tx.get(db.collection(COLLECTIONS.jobs()).doc(payment.jobId));
      if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
      const job = jobSnap.data() as ServiceJob;

      // Allocate invoice number and build invoice atomically
      const invoiceRef = db.collection(COLLECTIONS.invoices()).doc();
      const invoiceNumber = await allocateInvoiceNumber(tx, db, job.tenantId);
      const invoice = buildInvoice({
        invoiceId: invoiceRef.id,
        invoiceNumber,
        tenantId: job.tenantId,
        studioId: job.studioId,
        jobId: job.id,
        bookingId: job.bookingId,
        customerId: job.customerId,
        vehicleId: job.vehicleId,
        priceBreakdown: job.priceBreakdown,
        paymentId: data.paymentId,
        serviceName: `Service ${job.serviceId}`,
      });

      // Mark event as processed (idempotency) — first write, now that all reads are done
      tx.set(eventRef, { paymentId: data.paymentId, result: data.mockResult, processedAt: now });

      // Update payment → completed
      tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
        status: "completed",
        razorpayPaymentId: `mock_pay_${Date.now()}`,
        invoiceId: invoiceRef.id,
        completedAt: now,
        updatedAt: now,
      });

      // Update job → paid
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
      // this case — resolved by mirroring the booking auto-expiry pattern of
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
      // Payment failed — no reads in this branch, so the event write can go first.
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
