// Admin-only: initiates a refund on a completed payment.
// Mutates the original Payment record in place (status -> "refunded") — there
// is no partial-refund model or separate refund Payment record in this schema.
// In dev/emulator: mock provider is used. No live Razorpay refund API called.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment, Invoice } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { initiateRefundSchema } from "../../schemas/payment.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";

export const initiateRefund = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);

  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required to initiate refunds.");
  }

  const data = validate(initiateRefundSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.refund");

  const db = getFirestore();
  const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(data.paymentId).get();
  if (!paymentSnap.exists) throw new HttpsError("not-found", "Payment not found.");

  const payment = paymentSnap.data() as Payment;

  if (payment.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (payment.status !== "completed") {
    throw new HttpsError(
      "failed-precondition",
      "Can only refund completed payments.",
    );
  }

  const now = new Date().toISOString();

  // Refunds are single-shot per payment (this codebase has no partial-refund
  // model — see the Payment type's single refundAmount/refundedAt fields).
  // The provider refund call is a real external side effect (hits the live
  // Razorpay API in production) that must never run twice for one payment,
  // and it cannot safely live inside a Firestore transaction (transactions
  // retry; an external API call must not). So exclusivity is claimed with a
  // deterministic idempotency-event doc — the same pattern confirmPaymentMock.ts
  // already uses — BEFORE the provider is called: only one concurrent caller
  // can win this transaction, re-reading the payment fresh via tx.get() rather
  // than trusting the pre-transaction `payment` read above (Phase 5B fix —
  // previously payment.status was checked once, outside any transaction, and
  // never re-verified, so two concurrent initiateRefund calls both passed the
  // check and both issued real provider refunds).
  const refundEventRef = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${data.paymentId}`);
  await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(db.collection(COLLECTIONS.payments()).doc(data.paymentId));
    if (!freshSnap.exists) throw new HttpsError("not-found", "Payment not found.");
    const freshPayment = freshSnap.data() as Payment;
    if (freshPayment.status !== "completed") {
      throw new HttpsError(
        "failed-precondition",
        `Cannot refund a payment in status '${freshPayment.status}'.`,
      );
    }
    const eventSnap = await tx.get(refundEventRef);
    if (eventSnap.exists) {
      throw new HttpsError("already-exists", "A refund has already been initiated for this payment.");
    }
    tx.set(refundEventRef, { paymentId: data.paymentId, claimedAt: now, claimedBy: user.uid });
  });

  // Call provider refund (mock in dev, real Razorpay in production) — exactly
  // once, now that this call has exclusive claim on this payment's refund.
  // Deterministic referenceId (no Date.now()) so a network-level retry of
  // this exact call is idempotent at the provider too.
  let providerRefundId: string | null = null;
  try {
    if (payment.method === "razorpay_payment_link" && payment.razorpayPaymentId) {
      const provider = getPaymentProvider();
      const result = await provider.initiateRefund({
        providerPaymentId: payment.razorpayPaymentId,
        amount: payment.amount,
        reason: data.reason,
        referenceId: `refund_${data.paymentId}`,
      });
      providerRefundId = result.providerRefundId;
    }
  } catch (err) {
    // Provider call failed — release the claim so a genuine retry is
    // possible instead of permanently blocking this payment on
    // "already-exists" for a refund that never actually happened.
    await refundEventRef.delete().catch(() => undefined);
    throw err;
  }

  await db.runTransaction(async (tx) => {
    // All reads must happen before any writes within a Firestore transaction.
    const invoiceSnap = payment.invoiceId
      ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId))
      : null;

    // Mark original payment as refunded
    tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
      status: "refunded",
      razorpayRefundId: providerRefundId,
      refundAmount: payment.amount,
      refundedAt: now,
      updatedAt: now,
    });

    // Void the linked invoice (if any)
    if (payment.invoiceId && invoiceSnap) {
      if (invoiceSnap.exists) {
        const invoice = invoiceSnap.data() as Invoice;
        if (invoice.status !== "void") {
          tx.update(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId), {
            status: "void",
            voidedAt: now,
            voidedReason: `Refund initiated: ${data.reason}`,
            updatedAt: now,
          });
          writeAuditLog(tx, {
            action: "invoice.voided",
            entityType: "Invoice",
            entityId: payment.invoiceId,
            user,
            studioId: payment.studioId,
            after: { status: "void", reason: data.reason },
          });
        }
      }
    }

    // Update job paymentStatus — the job is always present, booking-sourced or walk-in
    if (payment.jobId) {
      tx.update(db.collection(COLLECTIONS.jobs()).doc(payment.jobId), {
        paymentStatus: "refunded",
        updatedAt: now,
      });
    }

    // Sync linked booking, if any
    if (payment.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(payment.bookingId), {
        paymentStatus: "refunded",
        updatedAt: now,
      });
    }

    writeAuditLog(tx, {
      action: "payment.refunded",
      entityType: "Payment",
      entityId: data.paymentId,
      user,
      studioId: payment.studioId,
      after: {
        status: "refunded",
        reason: data.reason,
        refundAmount: payment.amount,
        providerRefundId,
      },
    });
  });

  return { paymentId: data.paymentId, refunded: true, providerRefundId };
});
