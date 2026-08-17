// DEV/EMULATOR ONLY: Simulates a payment provider webhook internally.
// Allows testing the full payment → invoice flow without a real provider.
// Gated: only runs when FUNCTIONS_EMULATOR=true or USE_PAYMENT_MOCK=true.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment, Booking, ServiceJob } from "@autodeck/core";
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
  if (payment.status !== "pending" && payment.status !== "processing") {
    throw new HttpsError(
      "failed-precondition",
      `Payment is already in terminal state: ${payment.status}`,
    );
  }

  // Idempotency: check if this mock event was already processed
  const mockEventId = `mock_${data.paymentId}_${data.mockResult}`;
  const eventRef = db.collection(COLLECTIONS.paymentEvents()).doc(mockEventId);
  const eventSnap = await eventRef.get();
  if (eventSnap.exists) {
    return { paymentId: data.paymentId, result: data.mockResult, idempotent: true };
  }

  const now = new Date().toISOString();
  const isSuccess = data.mockResult === "success";

  await db.runTransaction(async (tx) => {
    // All reads must happen before any writes within a Firestore transaction —
    // the event-idempotency write is deferred until after the reads below.
    if (isSuccess) {
      // Fetch booking for invoice
      const bookingId = payment.bookingId;
      if (!bookingId) throw new HttpsError("failed-precondition", "Payment has no linked booking.");

      const bookingSnap = await tx.get(db.collection(COLLECTIONS.bookings()).doc(bookingId));
      if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
      const booking = bookingSnap.data() as Booking;

      // Fetch job for service name snapshot (try to find linked job)
      let serviceName = `Service ${booking.serviceId}`;
      const jobsSnap = await db
        .collection(COLLECTIONS.jobs())
        .where("bookingId", "==", bookingId)
        .limit(1)
        .get();
      if (!jobsSnap.empty) {
        const job = jobsSnap.docs[0]?.data() as ServiceJob;
        if (job) serviceName = `Service ${job.serviceId}`;
      }

      // Allocate invoice number and build invoice atomically
      const invoiceRef = db.collection(COLLECTIONS.invoices()).doc();
      const invoiceNumber = await allocateInvoiceNumber(tx, db, booking.tenantId);
      const invoice = buildInvoice({
        invoiceId: invoiceRef.id,
        invoiceNumber,
        booking,
        paymentId: data.paymentId,
        studioId: booking.studioId,
        serviceName,
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

      // Update booking → paymentStatus: paid
      tx.update(db.collection(COLLECTIONS.bookings()).doc(bookingId), {
        paymentStatus: "paid",
        updatedAt: now,
      });

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
