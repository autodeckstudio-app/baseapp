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
import { activeReservation } from "../../lib/refund-outbox.js";

export const initiateRefund = onCall({ region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"], enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
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
  // Mutual interlock with the booking-refund outbox: a payment with an active
  // outbox reservation is refused here, so this legacy single-shot path and
  // the outbox runner can never both submit provider refunds for the same
  // money (race order b; race order a is the outbox's refund_<paymentId>
  // legacy-claim check).
  // Fast path only - the authoritative check is inside the claim transaction
  // below, so an overlapping reservation cannot slip between read and claim.
  if (await activeReservation(db, payment.id)) {
    throw new HttpsError("already-exists", "A refund request is already active for this payment.");
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
    // D1: the outbox guard is read in THIS transaction, so the two paths
    // overlap-safe: if the outbox reservation commits first, this transaction
    // retries on the guard-doc conflict and refuses; if this claim commits
    // first, planReserveInTx's refund_<paymentId> read conflicts and refuses.
    const guardSnap = await tx.get(db.collection(COLLECTIONS.refundRequests()).doc(`active_${data.paymentId}`));
    if (guardSnap.exists) {
      throw new HttpsError("already-exists", "A refund request is already active for this payment.");
    }
    tx.set(refundEventRef, { paymentId: data.paymentId, claimedAt: now, claimedBy: user.uid });
  });

  // Call provider refund (mock in dev, real Razorpay in production) — exactly
  // once, now that this call has exclusive claim on this payment's refund.
  // Deterministic referenceId (no Date.now()) so a network-level retry of
  // this exact call is idempotent at the provider too.
  let providerRefundId: string | null = null;
  if (payment.method === "razorpay_payment_link" && payment.razorpayPaymentId) {
    const provider = getPaymentProvider();
    try {
      const result = await provider.initiateRefund({
        providerPaymentId: payment.razorpayPaymentId,
        amount: payment.amount,
        reason: data.reason,
        referenceId: `refund_${data.paymentId}`,
      });
      // A 2xx response alone is not money moved: only a refund the provider
      // already reports as processed may be projected below. Anything else
      // keeps the claim and stays a hold for reconciliation - the app does
      // not fabricate a completed refund.
      // Only AFFIRMATIVE processed evidence may project. A missing, null or
      // empty lifecycle status is not a completed refund: hold exactly like
      // any other non-processed outcome.
      if (result.status !== "processed") {
        throw new HttpsError(
          "unavailable",
          `Refund ${result.providerRefundId} accepted by the provider with status '${result.status ?? "unknown"}'; the refund claim is retained. Reconcile before any retry.`,
        );
      }
      providerRefundId = result.providerRefundId;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      // The provider outcome is UNKNOWN (e.g. the response was lost after
      // acceptance). NEVER release the claim on an unknown outcome: a
      // released claim would let a retry - or the outbox - submit a second
      // refund for the same money. Reconcile by the durable reference id:
      // only an authoritative provider negative releases the claim.
      let outcome: string = "unknown";
      let foundId: string | null = null;
      if (provider.findRefundByReference && payment.currency) {
        try {
          const lookup = await provider.findRefundByReference(`refund_${data.paymentId}`, {
            providerPaymentId: payment.razorpayPaymentId, amountPaise: payment.amount, currency: payment.currency,
          });
          outcome = lookup.outcome;
          if (lookup.outcome === "found") foundId = lookup.providerRefundId;
        } catch { outcome = "unknown"; }
      }
      if (outcome === "absent_confirmed") {
        // Authoritative: the provider never accepted this refund. Safe to
        // release the claim for a genuine retry.
        await refundEventRef.delete().catch(() => undefined);
        throw err;
      }
      if (outcome === "found" && foundId) {
        // The provider DID accept (and reports it processed): project it
        // truthfully below instead of losing the obligation.
        providerRefundId = foundId;
      } else {
        // failed notification or unknown: hold. Claim retained.
        throw new HttpsError(
          "unavailable",
          "Refund outcome could not be confirmed with the provider; the refund claim is retained so no second refund can be submitted. Reconcile before any retry.",
        );
      }
    }
  }

  // Converged = this exact provider refund was already accounted while this
  // handler was in flight (webhook event, or a replayed own projection):
  // the money is truthfully returned exactly once, so project nothing again.
  let converged = false;
  await db.runTransaction(async (tx) => {
    // All reads must happen before any writes within a Firestore transaction.
    // The payment is re-read INSIDE this transaction: the exclusivity claim
    // was won BEFORE the provider call, and another path (webhook event,
    // outbox projection) may have accounted money since. Never overwrite
    // another path's accounting from the stale pre-transaction snapshot.
    const freshSnap = await tx.get(db.collection(COLLECTIONS.payments()).doc(data.paymentId));
    if (!freshSnap.exists) throw new HttpsError("not-found", "Payment not found.");
    const fresh = freshSnap.data() as Payment;
    if (providerRefundId) {
      const ledgerSnap = await tx.get(
        db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${data.paymentId}_${providerRefundId}`),
      );
      if (ledgerSnap.exists) {
        // Same provider refund id, already accounted - by THIS path's own
        // earlier commit or by the webhook's strict-bound projection. Both
        // are the same money counted once: converge with zero writes.
        converged = true;
        return;
      }
    }
    // Any other accounting on this payment (a partial webhook projection, an
    // outbox projection) means this single-shot FULL-refund projection no
    // longer describes reality: overwriting refundAmount/status would erase
    // the other path's truthful partial state. HOLD with the claim retained.
    if (fresh.status !== "completed" || (fresh.refundAmount ?? 0) !== 0) {
      throw new HttpsError(
        "unavailable",
        `Payment state changed while the refund was in flight (status '${fresh.status}', refunded ${fresh.refundAmount ?? 0}); held for reconciliation. The refund claim is retained.`,
      );
    }
    const invoiceSnap = payment.invoiceId
      ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId))
      : null;

    // Mark original payment as refunded
    tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
      status: "refunded",
      razorpayRefundId: providerRefundId,
      refundAmount: fresh.amount,
      refundedAt: now,
      updatedAt: now,
    });
    // Cross-path per-refund identity: record this provider refund so a later
    // webhook event or outbox projection for the SAME refund cannot count it
    // again. The in-transaction READ above is what makes a racing webhook
    // projection conflict and retry into "duplicate" instead of double-counting.
    if (providerRefundId) {
      tx.set(db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${data.paymentId}_${providerRefundId}`), {
        paymentId: data.paymentId, providerRefundId,
        amountPaise: fresh.amount, currency: fresh.currency ?? null,
        source: "legacy", createdAt: now,
      });
    }

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

  return { paymentId: data.paymentId, refunded: true, providerRefundId, ...(converged ? { converged: true } : {}) };
});
