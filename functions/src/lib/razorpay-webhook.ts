// Applies a verified payment-provider event to Firestore. Pure of HTTP: the
// onRequest wrapper verifies the signature and calls processProviderEvent().
//
// Safe to receive the same event many times, and events out of order:
//  - every event id is claimed once in paymentEvents (inside the transaction);
//  - payment.link.paid and payment.captured both arrive for one payment, the
//    second one finds the payment already completed and changes nothing;
//  - the amount in the event must equal the stored payment amount, otherwise
//    nothing is marked paid and the event is recorded for review.
import type { Firestore } from "firebase-admin/firestore";
import type { Invoice, Membership, Payment, ServiceJob } from "@autodeck/core";
import { readUpgradeSource, endUpgradedMembership } from "./membership-upgrade.js";
import { MEMBERSHIP_DURATION_DAYS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import type { AuthorizedUser } from "@autodeck/auth";
import type { ProviderWebhookEvent } from "./payment-provider.js";
import { writeAuditLog } from "../middleware/audit.js";
import { prepareJobInvoice } from "./job-invoice.js";

export type WebhookOutcome =
  | "completed"
  | "failed"
  | "refunded"
  | "duplicate"
  | "already_final"
  | "unknown_payment"
  | "amount_mismatch"
  | "ignored";

function systemUser(tenantId: string): AuthorizedUser {
  return { uid: "system", displayName: "AutoDeck", email: null, claims: { role: "system", tenantId, studioId: null } } as unknown as AuthorizedUser;
}

async function findPayment(db: Firestore, ev: ProviderWebhookEvent): Promise<Payment | null> {
  const col = db.collection(COLLECTIONS.payments());
  if (ev.referenceId) {
    const s = await col.doc(ev.referenceId).get();
    if (s.exists) return s.data() as Payment;
  }
  const tries: Array<[string, string | null | undefined]> = [
    ["razorpayPaymentLinkId", ev.providerPaymentLinkId],
    ["razorpayPaymentId", ev.providerPaymentId],
    ["razorpayOrderId", ev.providerOrderId],
  ];
  for (const [field, value] of tries) {
    if (!value) continue;
    const q = await col.where(field, "==", value).limit(1).get();
    if (!q.empty) return q.docs[0]!.data() as Payment;
  }
  return null;
}

export async function processProviderEvent(
  db: Firestore,
  ev: ProviderWebhookEvent,
): Promise<{ outcome: WebhookOutcome; paymentId: string | null }> {
  const eventRef = db.collection(COLLECTIONS.paymentEvents()).doc(ev.providerEventId);
  const handled: ProviderWebhookEvent["eventType"][] = [
    "payment.captured", "payment.link.paid", "payment.failed", "refund.created",
  ];
  if (!handled.includes(ev.eventType)) {
    await eventRef.set({ eventType: ev.eventType, outcome: "ignored", processedAt: new Date().toISOString() }).catch(() => undefined);
    return { outcome: "ignored", paymentId: null };
  }

  const found = await findPayment(db, ev);
  if (!found) {
    // Not ours (or created outside the app). Acknowledge so Razorpay stops retrying; keep a trace.
    await eventRef.set({
      eventType: ev.eventType, outcome: "unknown_payment", providerPaymentId: ev.providerPaymentId,
      providerPaymentLinkId: ev.providerPaymentLinkId, processedAt: new Date().toISOString(),
    });
    return { outcome: "unknown_payment", paymentId: null };
  }

  const paymentRef = db.collection(COLLECTIONS.payments()).doc(found.id);
  const user = systemUser(found.tenantId);
  const now = new Date().toISOString();
  const isPaid = ev.eventType === "payment.captured" || ev.eventType === "payment.link.paid";

  const outcome = await db.runTransaction(async (tx): Promise<WebhookOutcome> => {
    // ---- reads ----
    const evSnap = await tx.get(eventRef);
    if (evSnap.exists) return "duplicate";
    const paySnap = await tx.get(paymentRef);
    const payment = paySnap.data() as Payment;
    const record = (o: WebhookOutcome) =>
      tx.set(eventRef, { eventType: ev.eventType, paymentId: payment.id, outcome: o, processedAt: now });

    if (isPaid) {
      if (payment.status === "completed" || payment.status === "refunded") { record("already_final"); return "already_final"; }
      if (ev.amount && ev.amount !== payment.amount) { record("amount_mismatch"); return "amount_mismatch"; }

      if (payment.targetType === "membership") {
        const mRef = payment.membershipId ? db.collection(COLLECTIONS.memberships()).doc(payment.membershipId) : null;
        const mSnap = mRef ? await tx.get(mRef) : null;
        const upgradeSrc = mSnap?.exists && (mSnap.data() as Membership).status === "pending" ? await readUpgradeSource(tx, db, mSnap.data() as Membership) : null;
        record("completed");
        tx.update(paymentRef, {
          status: "completed", razorpayPaymentId: ev.providerPaymentId || payment.razorpayPaymentId,
          providerEventId: ev.providerEventId, completedAt: now, updatedAt: now,
        });
        writeAuditLog(tx, { action: "payment.completed", entityType: "Payment", entityId: payment.id, user, studioId: null,
          after: { status: "completed", targetType: "membership", membershipId: payment.membershipId, via: "razorpay_webhook" } });
        if (mRef && mSnap?.exists && (mSnap.data() as Membership).status === "pending") {
          const startDate = now.slice(0, 10);
          const endDate = new Date(Date.parse(now) + MEMBERSHIP_DURATION_DAYS * 86400000).toISOString().slice(0, 10);
          endUpgradedMembership(tx, upgradeSrc, mRef.id, now);
          tx.update(mRef, { status: "active", startDate, endDate, activatedAt: now, activatedBy: "system", updatedAt: now });
          writeAuditLog(tx, { action: "membership.activated", entityType: "Membership", entityId: mRef.id, user, studioId: null,
            before: { status: "pending" }, after: { status: "active", startDate, endDate, via: "payment_verified" } });
        }
        return "completed";
      }

      if (!payment.jobId) { record("ignored"); return "ignored"; }
      const jobRef = db.collection(COLLECTIONS.jobs()).doc(payment.jobId);
      const jobSnap = await tx.get(jobRef);
      const job = jobSnap.data() as ServiceJob | undefined;
      // Money has arrived. If the job is gone, cancelled or already settled another way we still
      // record the payment as completed (it IS received) but touch nothing else, and flag it.
      const anomaly = !job ? "job_missing" : job.status === "CANCELLED" ? "job_cancelled" : job.paymentStatus === "paid" ? "job_already_paid" : null;
      const prepared = job && !anomaly ? await prepareJobInvoice(db, tx, job, payment.id) : null;
      record("completed");
      if (!job || anomaly || !prepared || prepared.existing) {
        tx.update(paymentRef, { status: "completed", razorpayPaymentId: ev.providerPaymentId || payment.razorpayPaymentId,
          providerEventId: ev.providerEventId, completedAt: now, updatedAt: now });
        writeAuditLog(tx, { action: "payment.completed", entityType: "Payment", entityId: payment.id, user, studioId: payment.studioId,
          after: { status: "completed", via: "razorpay_webhook" }, metadata: { needsReview: anomaly ?? "invoice_exists" } });
        return "completed";
      }
      const { invoiceRef, invoice } = prepared;
      tx.update(paymentRef, { status: "completed", razorpayPaymentId: ev.providerPaymentId || payment.razorpayPaymentId,
        invoiceId: invoiceRef.id, providerEventId: ev.providerEventId, completedAt: now, updatedAt: now });
      tx.set(invoiceRef, invoice);
      tx.update(jobRef, { paymentStatus: "paid", updatedAt: now });
      if (job.bookingId) tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), { paymentStatus: "paid", updatedAt: now });
      writeAuditLog(tx, { action: "payment.completed", entityType: "Payment", entityId: payment.id, user, studioId: payment.studioId,
        after: { status: "completed", invoiceId: invoiceRef.id, via: "razorpay_webhook" } });
      writeAuditLog(tx, { action: "invoice.issued", entityType: "Invoice", entityId: invoiceRef.id, user, studioId: payment.studioId,
        after: { invoiceNumber: invoice.invoiceNumber, total: invoice.total, status: "issued" } });
      return "completed";
    }

    if (ev.eventType === "payment.failed") {
      if (payment.status !== "pending" && payment.status !== "processing") { record("already_final"); return "already_final"; }
      const mRef = payment.targetType === "membership" && payment.membershipId
        ? db.collection(COLLECTIONS.memberships()).doc(payment.membershipId) : null;
      const mSnap = mRef ? await tx.get(mRef) : null;
      record("failed");
      // A failed attempt on a payment LINK is not final: the customer can retry on the same link, and a
      // later payment.link.paid must still be able to complete it. Only note the attempt.
      if (payment.method === "razorpay_payment_link") {
        tx.update(paymentRef, { providerEventId: ev.providerEventId, updatedAt: now });
        return "failed";
      }
      tx.update(paymentRef, { status: "failed", failedAt: now, providerEventId: ev.providerEventId, updatedAt: now });
      writeAuditLog(tx, { action: "payment.failed", entityType: "Payment", entityId: payment.id, user, studioId: payment.studioId,
        after: { status: "failed", via: "razorpay_webhook" } });
      if (mRef && mSnap?.exists && (mSnap.data() as Membership).status === "pending") {
        tx.update(mRef, { status: "cancelled", cancelledAt: now, cancelledBy: "system", cancellationReason: "payment_failed", updatedAt: now });
      }
      return "failed";
    }

    // refund.created (e.g. refunded from the Razorpay dashboard rather than the admin app)
    if (payment.status === "refunded") { record("already_final"); return "already_final"; }
    if (payment.status !== "completed") { record("ignored"); return "ignored"; }
    const invSnap = payment.invoiceId ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId)) : null;
    record("refunded");
    tx.update(paymentRef, { status: "refunded", razorpayRefundId: ev.providerRefundId, refundAmount: ev.amount || payment.amount,
      refundedAt: now, providerEventId: ev.providerEventId, updatedAt: now });
    if (payment.invoiceId && invSnap?.exists && (invSnap.data() as Invoice).status !== "void") {
      tx.update(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId), { status: "void", voidedAt: now,
        voidedReason: "Refunded via payment provider", updatedAt: now });
      writeAuditLog(tx, { action: "invoice.voided", entityType: "Invoice", entityId: payment.invoiceId, user, studioId: payment.studioId,
        after: { status: "void", reason: "refund" } });
    }
    if (payment.jobId) tx.update(db.collection(COLLECTIONS.jobs()).doc(payment.jobId), { paymentStatus: "refunded", updatedAt: now });
    if (payment.bookingId) tx.update(db.collection(COLLECTIONS.bookings()).doc(payment.bookingId), { paymentStatus: "refunded", updatedAt: now });
    writeAuditLog(tx, { action: "payment.refunded", entityType: "Payment", entityId: payment.id, user, studioId: payment.studioId,
      after: { status: "refunded", refundAmount: ev.amount || payment.amount, providerRefundId: ev.providerRefundId, via: "razorpay_webhook" } });
    return "refunded";
  });

  return { outcome, paymentId: found.id };
}
