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
import type { Booking, Gift, Invoice, Membership, Payment, ServiceJob } from "@autodeck/core";
import { planGiftActivation } from "./gift-activate.js";
import { readUpgradeSource, endUpgradedMembership } from "./membership-upgrade.js";
import { MEMBERSHIP_DURATION_DAYS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import type { AuthorizedUser } from "@autodeck/auth";
import type { ProviderWebhookEvent } from "./payment-provider.js";
import { writeAuditLog } from "../middleware/audit.js";
import { prepareJobInvoice } from "./job-invoice.js";
import { runRefundOutbox, adoptProcessedRefundEvidence } from "./refund-outbox.js";
import { getPaymentProvider } from "./razorpay-provider.js";

export type WebhookOutcome =
  | "completed"
  | "failed"
  | "refunded"
  | "duplicate"
  | "already_final"
  | "unknown_payment"
  | "amount_mismatch"
  | "outbox_owned"
  | "ownership_mismatch"
  | "refund_pending"
  | "related_mismatch"
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

/**
 * Durable outbox ownership of an incoming refund event.
 *
 * Three verdicts:
 *  - "owned": a persisted refund request binds this event on every axis -
 *    the refund entity's OWN payment id equals the stored payment's
 *    razorpayPaymentId, the request's paymentId equals the stored payment id,
 *    the refund amount equals the requested amount, and the refund currency
 *    equals the stored payment currency. Missing evidence never agrees.
 *  - "mismatch": recognized ownership evidence (a persisted request matched
 *    by receipt or provider refund id, or a receipt in our rr_ namespace)
 *    whose binding is missing or conflicting. Fail-closed: recorded, held,
 *    zero financial writes.
 *  - "unrelated": no ownership evidence at all; the legacy generic path
 *    applies (subject to the refund lifecycle gate).
 */
async function evaluateOutboxOwnership(
  tx: FirebaseFirestore.Transaction,
  db: Firestore,
  ev: ProviderWebhookEvent,
  payment: Payment,
): Promise<"owned" | "mismatch" | "unrelated"> {
  const col = db.collection(COLLECTIONS.refundRequests());
  const candidates: FirebaseFirestore.DocumentData[] = [];
  if (ev.providerRefundReceipt) {
    const snap = await tx.get(col.doc(ev.providerRefundReceipt));
    if (snap.exists) candidates.push(snap.data()!);
  }
  if (candidates.length === 0 && ev.providerRefundId) {
    const q = await tx.get(col.where("providerRefundId", "==", ev.providerRefundId).limit(3));
    for (const d of q.docs) candidates.push(d.data());
  }
  if (candidates.length === 0) {
    // Our receipt namespace with no persisted request is malformed
    // known-ownership evidence, not an unrelated refund.
    if (ev.providerRefundReceipt && ev.providerRefundReceipt.startsWith("rr_")) return "mismatch";
    return "unrelated";
  }
  const strictBind = (r: { paymentId?: string; amountPaise?: number }): boolean =>
    !!ev.providerRefundPaymentId &&
    ev.providerRefundPaymentId === payment.razorpayPaymentId &&
    r.paymentId === payment.id &&
    typeof ev.providerRefundAmount === "number" &&
    ev.providerRefundAmount === r.amountPaise &&
    !!ev.providerRefundCurrency &&
    !!payment.currency &&
    ev.providerRefundCurrency === payment.currency;
  return candidates.some(strictBind) ? "owned" : "mismatch";
}

export async function processProviderEvent(
  db: Firestore,
  ev: ProviderWebhookEvent,
): Promise<{ outcome: WebhookOutcome; paymentId: string | null }> {
  const eventRef = db.collection(COLLECTIONS.paymentEvents()).doc(ev.providerEventId);
  const handled: ProviderWebhookEvent["eventType"][] = [
    // "payment_link.paid" is the name Razorpay actually documents and emits for payment links
    // (https://razorpay.com/docs/webhooks/payment-links); "payment.link.paid" is kept so any
    // endpoint already subscribed to the legacy name keeps working.
    "payment.captured", "payment.link.paid", "payment_link.paid", "payment.failed", "refund.created", "refund.processed",
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
  const isPaid =
    ev.eventType === "payment.captured" || ev.eventType === "payment.link.paid" || ev.eventType === "payment_link.paid";

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

      if (payment.targetType === "gift") {
        // A verified gift payment: complete the payment and turn the gift on (60 days start now), in this one transaction.
        const gRef = payment.giftId ? db.collection(COLLECTIONS.gifts()).doc(payment.giftId) : null;
        const gSnap = gRef ? await tx.get(gRef) : null;
        const plan = planGiftActivation(gSnap?.exists ? (gSnap.data() as Gift) : undefined, payment, now);
        record("completed");
        tx.update(paymentRef, { status: "completed", razorpayPaymentId: ev.providerPaymentId || payment.razorpayPaymentId,
          providerEventId: ev.providerEventId, completedAt: now, updatedAt: now });
        writeAuditLog(tx, { action: "payment.completed", entityType: "Payment", entityId: payment.id, user, studioId: null,
          after: { status: "completed", targetType: "gift", giftId: payment.giftId ?? null, via: "razorpay_webhook" },
          ...(plan.activate ? {} : { metadata: { needsReview: plan.reason } }) });
        if (gRef && plan.activate) {
          tx.update(gRef, plan.patch);
          writeAuditLog(tx, { action: "gift.activated", entityType: "Gift", entityId: gRef.id, user, studioId: null,
            before: { status: "PENDING_PAYMENT" }, after: { status: "ACTIVE", expiresAt: plan.patch.expiresAt, via: "payment_verified" } });
        }
        return "completed";
      }

      if (!payment.jobId) { record("ignored"); return "ignored"; }
      const jobRef = db.collection(COLLECTIONS.jobs()).doc(payment.jobId);
      const jobSnap = await tx.get(jobRef);
      const job = jobSnap.data() as ServiceJob | undefined;
      const bookingRef = job?.bookingId ? db.collection(COLLECTIONS.bookings()).doc(job.bookingId) : null;
      const booking = bookingRef ? ((await tx.get(bookingRef)).data() as Booking | undefined) : undefined;
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
      if (bookingRef) {
        // Paying a held (PENDING) online booking confirms it. Paid bookings that were already confirmed only get the payment flag.
        const confirms = booking?.status === "PENDING";
        tx.update(bookingRef, { paymentStatus: "paid", ...(confirms ? { status: "CONFIRMED", confirmedAt: now, holdExpiresAt: null } : {}), updatedAt: now });
        if (confirms) writeAuditLog(tx, { action: "booking.confirmed", entityType: "Booking", entityId: bookingRef.id, user, studioId: payment.studioId, before: { status: "PENDING" }, after: { status: "CONFIRMED", via: "payment" } });
      }
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

    // refund.created / refund.processed (e.g. refunded from the Razorpay dashboard
    // rather than the admin app). A partially refunded payment is NOT final: a later
    // event for another partial on the same payment must still account truthfully.
    if (payment.status === "refunded") { record("already_final"); return "already_final"; }
    if (payment.status !== "completed" && (payment.status as string) !== "partially_refunded") { record("ignored"); return "ignored"; }
    // Refund-outbox ownership, checked BEFORE any generic projection and
    // durable across the outbox lifecycle: an outbox-created refund carries
    // our request id as the provider receipt, or matches a persisted
    // request's providerRefundId. The request document survives projection
    // and guard release, and ownership binds payment id + amount + currency -
    // so a delayed or out-of-order refund.created for an outbox refund is
    // recorded but never generically projected here (no premature
    // full-amount write, no invoice void, no gift void). Refunds with no
    // outbox owner (dashboard / legacy admin path) keep the generic path.
    const ownership = await evaluateOutboxOwnership(tx, db, ev, payment);
    if (ownership === "owned") { record("outbox_owned"); return "outbox_owned"; }
    if (ownership === "mismatch") { record("ownership_mismatch"); return "ownership_mismatch"; }
    // Lifecycle gate for unrelated (dashboard / legacy) refunds: only
    // affirmative "processed" evidence may project money as returned. A
    // pending, failed or statusless refund.created is recorded and held for
    // reconciliation with zero financial writes.
    if (ev.providerRefundStatus !== "processed") { record("refund_pending"); return "refund_pending"; }
    // Strict binding for the UNRELATED path too: the refund entity's own
    // payment id and currency must agree with the stored payment - missing
    // or conflicting evidence fails closed with zero writes.
    if (!ev.providerRefundId ||
        !ev.providerRefundPaymentId || ev.providerRefundPaymentId !== payment.razorpayPaymentId ||
        !ev.providerRefundCurrency || ev.providerRefundCurrency !== payment.currency) {
      record("ownership_mismatch");
      return "ownership_mismatch";
    }
    // Truthful amount: the refund entity's OWN amount is the money returned.
    // Integer paise only; missing/fractional/non-positive evidence is held
    // with zero writes, never defaulted.
    const eventRefundAmount = ev.providerRefundAmount;
    if (typeof eventRefundAmount !== "number" || !Number.isInteger(eventRefundAmount) || eventRefundAmount <= 0) {
      record("refund_pending");
      return "refund_pending";
    }
    // Durable per-refund identity: the SAME provider refund must be counted
    // exactly once across refund.created/refund.processed, duplicate
    // deliveries with distinct event ids, and every code path. The ledger
    // doc is created inside this transaction; a racing delivery conflicts
    // and retries into "duplicate".
    const ledgerRef = db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${payment.id}_${ev.providerRefundId}`);
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) {
      // Convergence must agree on identity, not just existence: an existing
      // ledger entry under this refund id binding a DIFFERENT amount or
      // currency is conflicting evidence - hold with zero writes, never
      // silently treat it as a duplicate of this event.
      const prior = ledgerSnap.data() as { amountPaise?: unknown; currency?: unknown; paymentId?: unknown; providerRefundId?: unknown };
      if (prior.amountPaise !== eventRefundAmount || prior.currency !== ev.providerRefundCurrency ||
          prior.paymentId !== payment.id || prior.providerRefundId !== ev.providerRefundId) {
        record("ownership_mismatch");
        return "ownership_mismatch";
      }
      record("duplicate"); return "duplicate";
    }
    // Prior accounting must be well-formed before it is trusted in a money
    // total: the stored amount must be positive integer paise and any stored
    // refundAmount a non-negative integer within it. Malformed prior state
    // is held with zero writes for reconciliation, never silently extended.
    if (typeof payment.amount !== "number" || !Number.isInteger(payment.amount) || payment.amount <= 0 ||
        (payment.refundAmount !== undefined && payment.refundAmount !== null &&
          (typeof payment.refundAmount !== "number" || !Number.isInteger(payment.refundAmount) ||
           payment.refundAmount < 0 || payment.refundAmount > payment.amount))) {
      record("amount_mismatch");
      return "amount_mismatch";
    }
    const totalRefunded = (payment.refundAmount ?? 0) + eventRefundAmount;
    // An over-refund is never valid: hold with zero writes for
    // reconciliation rather than capping or marking full.
    if (totalRefunded > payment.amount) {
      record("amount_mismatch");
      return "amount_mismatch";
    }
    const fullyRefunded = totalRefunded === payment.amount;
    const invSnap = payment.invoiceId ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId)) : null;
    const giftRefRefund = payment.targetType === "gift" && payment.giftId ? db.collection(COLLECTIONS.gifts()).doc(payment.giftId) : null;
    const giftSnapRefund = giftRefRefund ? await tx.get(giftRefRefund) : null;
    const jobRefRefund = payment.jobId ? db.collection(COLLECTIONS.jobs()).doc(payment.jobId) : null;
    const jobSnapRefund = jobRefRefund ? await tx.get(jobRefRefund) : null;
    const bookingRefRefund = payment.bookingId ? db.collection(COLLECTIONS.bookings()).doc(payment.bookingId) : null;
    const bookingSnapRefund = bookingRefRefund ? await tx.get(bookingRefRefund) : null;
    // Related documents must still be the payment's OWN records before any of
    // them is written. A doc the payment links to must exist (a dangling link
    // means the linkage drifted), must sit in the payment's tenant, and must
    // point back along the SAME linkage: a same-tenant invoice for another
    // job or payment, a job on a different booking, or a gift bound to a
    // different payment must never absorb this refund's writes. Any break
    // fails closed with zero financial writes.
    const inv = invSnap?.exists ? (invSnap.data() as Invoice) : null;
    const gift = giftSnapRefund?.exists ? (giftSnapRefund.data() as Gift) : null;
    const job = jobSnapRefund?.exists ? (jobSnapRefund.data() as ServiceJob) : null;
    const booking = bookingSnapRefund?.exists ? (bookingSnapRefund.data() as Booking) : null;
    const relatedMismatch =
      // A carried link must resolve: dangling invoiceId/giftId/jobId/bookingId.
      (payment.invoiceId ? !inv : invSnap !== null && !inv) ||
      (giftRefRefund ? !gift : false) ||
      (jobRefRefund ? !job : false) ||
      (bookingRefRefund ? !booking : false) ||
      // Invoice: same tenant, same job, same booking (strict nullable), and
      // if a payment is linked it must be THIS payment.
      (inv ? inv.tenantId !== payment.tenantId || inv.jobId !== payment.jobId ||
             (inv.bookingId ?? null) !== (payment.bookingId ?? null) ||
             (inv.paymentId ?? null) !== null && inv.paymentId !== payment.id : false) ||
      // Gift: same tenant, and if bound to a payment it must be THIS payment.
      (gift ? gift.tenantId !== payment.tenantId ||
              (gift.paymentId ?? null) !== null && gift.paymentId !== payment.id : false) ||
      // Job: same tenant, same booking (strict nullable).
      (job ? job.tenantId !== payment.tenantId || (job.bookingId ?? null) !== (payment.bookingId ?? null) : false) ||
      // Booking: same tenant.
      (booking ? booking.tenantId !== payment.tenantId : false);
    if (relatedMismatch) { record("related_mismatch"); return "related_mismatch"; }
    // Reads are all done; the ledger entry lands atomically with the writes.
    // Race safety comes from the in-transaction READ above: a concurrent
    // delivery of the same refund conflicts on that read and retries into
    // "duplicate".
    tx.set(ledgerRef, {
      paymentId: payment.id, providerRefundId: ev.providerRefundId,
      amountPaise: eventRefundAmount, currency: ev.providerRefundCurrency,
      source: "webhook", providerEventId: ev.providerEventId, createdAt: now,
    });
    record("refunded");
    // Invoice and gift obligations survive a PARTIAL refund: only a fully
    // refunded payment voids them (preexisting full-refund obligation).
    if (fullyRefunded && giftRefRefund && giftSnapRefund?.exists && (giftSnapRefund.data() as Gift).status !== "REDEEMED") {
      tx.update(giftRefRefund, { status: "REFUNDED", voidedAt: now, voidReason: "Payment refunded" });
      writeAuditLog(tx, { action: "gift.voided", entityType: "Gift", entityId: giftRefRefund.id, user, studioId: null, after: { reason: "payment_refunded" } });
    }
    tx.update(paymentRef, { status: fullyRefunded ? "refunded" : ("partially_refunded" as Payment["status"]),
      razorpayRefundId: ev.providerRefundId, refundAmount: totalRefunded,
      refundedAt: now, providerEventId: ev.providerEventId, updatedAt: now });
    if (fullyRefunded && payment.invoiceId && invSnap?.exists && (invSnap.data() as Invoice).status !== "void") {
      tx.update(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId), { status: "void", voidedAt: now,
        voidedReason: "Refunded via payment provider", updatedAt: now });
      writeAuditLog(tx, { action: "invoice.voided", entityType: "Invoice", entityId: payment.invoiceId, user, studioId: payment.studioId,
        after: { status: "void", reason: "refund" } });
    }
    const settledStatus = fullyRefunded ? "refunded" : "partially_refunded";
    if (jobRefRefund) tx.update(jobRefRefund, { paymentStatus: settledStatus, updatedAt: now });
    if (bookingRefRefund) tx.update(bookingRefRefund, { paymentStatus: settledStatus, updatedAt: now });
    writeAuditLog(tx, { action: "payment.refunded", entityType: "Payment", entityId: payment.id, user, studioId: payment.studioId,
      after: { status: settledStatus, refundAmount: totalRefunded, providerRefundId: ev.providerRefundId, via: "razorpay_webhook" } });
    return "refunded";
  });

  // Execution ownership for outbox-owned refunds.
  //
  // What an event CANNOT do: submit. A cancellation reservation emits no
  // provider event, so submission ownership lives with the reservation
  // commit's post-transaction drain (adminCancelBooking / requestBookingRefund)
  // and the manual runner - never with event handling. An event-driven pass
  // is reconcile-ONLY and scoped to the ONE request this event binds to, so
  // no event can ever submit unrelated reservations.
  //
  // What an owned "processed" event MUST do: its evidence is adopted into
  // its OWN request first (adoptProcessedRefundEvidence) - a refund the
  // provider already processed is projected from that evidence with ZERO
  // provider calls, never re-submitted into a second refund.
  //
  // Retry safety: a duplicate redelivery of an already-recorded owned event
  // re-runs the same idempotent drain, so a failed first attempt is retried
  // by provider redelivery instead of being lost behind the event claim. A
  // drain failure is written onto the request (durable, visible to the
  // held-requests surface) and the open request stays reconcilable by any
  // later trigger.
  const ownedProcessed = ev.providerRefundStatus === "processed" &&
    (ev.eventType === "refund.created" || ev.eventType === "refund.processed");
  let drainWanted = outcome === "outbox_owned" && ownedProcessed;
  if (!drainWanted && outcome === "duplicate" && ownedProcessed) {
    const prior = await eventRef.get().catch(() => null);
    drainWanted = !!prior?.exists && (prior.data() as { outcome?: string }).outcome === "outbox_owned";
  }
  if (drainWanted) {
    // Re-derive the same binding the in-transaction ownership check proved.
    let requestId: string | null = null;
    if (ev.providerRefundReceipt && ev.providerRefundReceipt.startsWith("rr_")) {
      requestId = ev.providerRefundReceipt;
    }
    if (!requestId && ev.providerRefundId) {
      const q = await db.collection(COLLECTIONS.refundRequests())
        .where("providerRefundId", "==", ev.providerRefundId).limit(1).get().catch(() => null);
      requestId = q && !q.empty ? q.docs[0]!.id : null;
    }
    if (requestId) {
      try {
        // The drain runs ONLY on evidence that binds completely to the
        // request's current docs. Anything missing or conflicting holds the
        // request with the reason on it and moves NOTHING - a mismatched
        // event must never trigger work.
        let verdict: string = "missing";
        if (ev.providerRefundId) {
          verdict = await adoptProcessedRefundEvidence(db, {
            requestId,
            providerRefundId: ev.providerRefundId,
            providerPaymentId: ev.providerRefundPaymentId ?? null,
            amountPaise: typeof ev.providerRefundAmount === "number" ? ev.providerRefundAmount : null,
            currency: ev.providerRefundCurrency ?? null,
          });
        }
        if (verdict === "conflict" || verdict === "missing") {
          await db.collection(COLLECTIONS.refundRequests()).doc(requestId).update({
            lastError: `processed evidence ${ev.providerRefundId ?? "(no provider refund id)"} does not bind to this request (${verdict}); held for reconciliation - no drain ran`,
            updatedAt: new Date().toISOString(),
          }).catch(() => undefined);
        } else {
          await runRefundOutbox(db, getPaymentProvider(), { requestId, submit: false });
        }
      } catch (err) {
        await db.collection(COLLECTIONS.refundRequests()).doc(requestId).update({
          lastError: `post-event drain failed: ${err instanceof Error ? err.message : String(err)}`,
          updatedAt: new Date().toISOString(),
        }).catch(() => undefined);
      }
    }
  }

  return { outcome, paymentId: found.id };
}
