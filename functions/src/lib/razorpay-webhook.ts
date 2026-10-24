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
import { planReserveInTx, applyReserveInTx } from "./refund-outbox.js";
import { planGiftActivation } from "./gift-activate.js";
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
  | "link_expired"
  | "ambiguous_link"
  | "link_cancelled"
  | "already_final"
  | "unknown_payment"
  | "amount_mismatch"
  | "refund_accepted"
  | "refund_processed"
  | "refund_unmatched"
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
    "payment.captured", "payment.link.paid", "payment_link.paid", "payment_link.expired", "payment_link.cancelled", "payment.failed", "refund.created", "refund.processed",
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

  const documentedLinkEvent = ev.eventType === "payment_link.paid" || ev.eventType === "payment_link.expired" || ev.eventType === "payment_link.cancelled";
  if (documentedLinkEvent && ev.providerPaymentLinkId) {
    // Fail closed if more than one payment stores this link id: limit(1) lookups must never pick arbitrarily.
    const dup = await db.collection(COLLECTIONS.payments()).where("razorpayPaymentLinkId", "==", ev.providerPaymentLinkId).limit(2).get();
    if (dup.size > 1) {
      // Make it staff-visible in a staff-only collection (never on the customer-readable payment doc).
      const stamp = new Date().toISOString();
      await Promise.all(dup.docs.map((d) => {
        const cand = d.data() as Payment;
        return db.collection(COLLECTIONS.staffAlerts()).doc(`ambiguous_payment_link_${cand.id}`).set({
          id: `ambiguous_payment_link_${cand.id}`, tenantId: cand.tenantId, studioId: cand.studioId ?? null,
          kind: "ambiguous_payment_link", paymentId: cand.id, createdAt: stamp,
        }, { merge: true });
      }));
      await eventRef.set({ eventType: ev.eventType, outcome: "ambiguous_link", providerPaymentLinkId: ev.providerPaymentLinkId, processedAt: new Date().toISOString() });
      return { outcome: "ambiguous_link", paymentId: null };
    }
  }

  const paymentRef = db.collection(COLLECTIONS.payments()).doc(found.id);
  const user = systemUser(found.tenantId);
  const now = new Date().toISOString();
  const isPaid = ev.eventType === "payment.captured" || ev.eventType === "payment.link.paid" || ev.eventType === "payment_link.paid";

  const outcome = await db.runTransaction(async (tx): Promise<WebhookOutcome> => {
    // ---- reads ----
    const evSnap = await tx.get(eventRef);
    if (evSnap.exists) return "duplicate";
    const paySnap = await tx.get(paymentRef);
    const payment = paySnap.data() as Payment;
    const record = (o: WebhookOutcome) =>
      tx.set(eventRef, { eventType: ev.eventType, paymentId: payment.id, outcome: o, processedAt: now });

    if (ev.eventType === "refund.processed") {
      // Provider status only: the booking says "processed" when THIS exact refund (id, amount, currency, tenant, payment, booking)
      // matches what we stored. No money, payment, invoice or job field is touched. Anything else: no booking write, private alert.
      const bookingRef = payment.bookingId ? db.collection(COLLECTIONS.bookings()).doc(payment.bookingId) : null;
      const bSnap = bookingRef ? await tx.get(bookingRef) : null;
      const b = bSnap?.exists ? (bSnap.data() as Booking) : null;
      const rid = ev.providerRefundId;
      const reqSnap = rid ? await tx.get(db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", payment.id).where("providerRefundId", "==", rid).limit(2)) : null;
      const stored = reqSnap && reqSnap.size === 1 ? (reqSnap.docs[0]!.data() as { tenantId: string; bookingId: string | null; amountPaise: number }) : null;
      const amt = ev.providerRefundAmount;
      // The stored refund id + amount come from either our refund request (customer/outbox path) or the booking itself (admin cancel path).
      const storedOk = stored
        ? stored.tenantId === payment.tenantId && stored.bookingId === payment.bookingId && stored.amountPaise === amt && (!b?.refundId || b.refundId === rid)
        : !!(b && b.refundId === rid && b.refundedPaise === amt);
      const matches = !!(rid && bookingRef && b && b.id === payment.bookingId && b.tenantId === payment.tenantId
        && payment.razorpayRefundId === rid && (payment.status === "refunded" || payment.status === "partially_refunded")
        && typeof amt === "number" && amt > 0 && storedOk && !!payment.currency && ev.currency === payment.currency);
      if (matches && b!.refundStatus === "processed") { record("already_final"); return "already_final"; }
      if (matches && b!.refundStatus === "initiated") {
        tx.update(bookingRef!, { refundStatus: "processed", refundProcessedAt: now, updatedAt: now });
        record("refund_processed");
        return "refund_processed";
      }
      const alertRef = db.collection(COLLECTIONS.staffAlerts()).doc(`refund_processed_unmatched_${ev.providerEventId}`);
      tx.set(alertRef, { id: alertRef.id, tenantId: payment.tenantId, studioId: payment.studioId ?? null,
        kind: "refund_processed_unmatched", paymentId: payment.id, createdAt: now });
      record("refund_unmatched");
      return "refund_unmatched";
    }

    if (isPaid) {
      // completed/refunded are final; partially_refunded is final for capture too —
      // a late capture event must never reactivate money that was partly returned.
      if (payment.status === "completed" || payment.status === "refunded" || payment.status === "partially_refunded") { record("already_final"); return "already_final"; }
      if (ev.eventType === "payment_link.paid") {
        // NEW documented-name path fails closed: the stored link id must match, and amount and currency must be present and equal.
        if (!ev.providerPaymentLinkId || payment.razorpayPaymentLinkId !== ev.providerPaymentLinkId || (ev.referenceId && ev.referenceId !== payment.id)) { record("unknown_payment"); return "unknown_payment"; }
        if (payment.razorpayPaymentId && ev.providerPaymentId && payment.razorpayPaymentId !== ev.providerPaymentId) { record("unknown_payment"); return "unknown_payment"; }
        if (!ev.amount || ev.amount !== payment.amount || !payment.currency || ev.currency !== payment.currency) { record("amount_mismatch"); return "amount_mismatch"; }
      }
      if (ev.amount && ev.amount !== payment.amount) { record("amount_mismatch"); return "amount_mismatch"; }

      if (payment.targetType === "membership") {
        const mRef = payment.membershipId ? db.collection(COLLECTIONS.memberships()).doc(payment.membershipId) : null;
        const mSnap = mRef ? await tx.get(mRef) : null;
        // Capture arrived for a membership that is already cancelled or expired: never activate it, and mark it for a full refund reservation below.
        const lateMembership = !!(mSnap?.exists && ["cancelled", "expired"].includes((mSnap.data() as Membership).status));
        // Late capture: the full-refund RESERVATION is planned (reads) here and committed in THIS transaction with the
        // payment completion and the event doc, so they land together or not at all. Reservation only: no provider call.
        const reservePlan = lateMembership
          ? await planReserveInTx(tx, db, { payment: { ...payment, status: "completed" }, amountPaise: payment.amount, reason: "late_membership_payment", createdBy: "system" })
          : null;
        const upgradeSrc = mSnap?.exists && (mSnap.data() as Membership).status === "pending" ? await readUpgradeSource(tx, db, mSnap.data() as Membership) : null;
        record("completed");
        tx.update(paymentRef, {
          status: "completed", razorpayPaymentId: ev.providerPaymentId || payment.razorpayPaymentId,
          providerEventId: ev.providerEventId, completedAt: now, updatedAt: now,
        });
        writeAuditLog(tx, { action: "payment.completed", entityType: "Payment", entityId: payment.id, user, studioId: null,
          after: { status: "completed", targetType: "membership", membershipId: payment.membershipId, via: "razorpay_webhook" } });
        if (reservePlan) {
          const alertRef = db.collection(COLLECTIONS.staffAlerts()).doc(`late_membership_payment_${payment.id}`);
          if (reservePlan.ok) applyReserveInTx(tx, reservePlan);
          // A deterministic refusal (e.g. an active reservation already exists) is flagged, never retried by redelivery.
          tx.set(alertRef, { id: alertRef.id, tenantId: payment.tenantId, studioId: payment.studioId ?? null,
            kind: reservePlan.ok ? "late_membership_payment" : reservePlan.code === "same_reservation" ? "late_membership_already_reserved" : "late_membership_refund_not_reserved",
            paymentId: payment.id, createdAt: now,
            // Private obligation evidence. The amount is the STORED payment amount only when it is positive; never invented.
            ...(reservePlan.ok ? {} : { reservationOutcome: reservePlan.code, reason: "late_membership_payment",
              owedAmountPaise: payment.amount > 0 ? payment.amount : null, currency: payment.currency ?? null }) });
        }
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

    if (ev.eventType === "payment_link.expired" || ev.eventType === "payment_link.cancelled") {
      // Terminal for the LINK only. Recorded for reconciliation; no slot release, cancel or refund here
      // (no waiting-cancel state exists yet). Correlation must be by the stored link id.
      const o: WebhookOutcome = ev.eventType === "payment_link.expired" ? "link_expired" : "link_cancelled";
      if (!ev.providerPaymentLinkId || payment.razorpayPaymentLinkId !== ev.providerPaymentLinkId) { record("unknown_payment"); return "unknown_payment"; }
      if (payment.status !== "pending") { record("already_final"); return "already_final"; }
      record(o);
      tx.update(paymentRef, { providerEventId: ev.providerEventId, linkTerminal: o, linkTerminalAt: now, updatedAt: now });
      return o;
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
    if (payment.status !== "completed" && payment.status !== "partially_refunded") { record("ignored"); return "ignored"; }

    // Reserved refunds (our outbox): the event is the provider's acceptance of
    // a submission we made. Validate it against the reservation — payment,
    // tenant, amount and refund id — and record acceptance ONLY. Truthful
    // projection onto payment/job/booking belongs to the runner's reconcile
    // step, never to this webhook.
    {
      const { activeReservation } = await import("./refund-outbox.js");
      const reservation = await activeReservation(db, payment.id);
      if (reservation) {
        if (reservation.tenantId !== payment.tenantId) { record("ignored"); return "ignored"; }
        if (ev.amount && ev.amount !== reservation.amountPaise) { record("amount_mismatch"); return "amount_mismatch"; }
        if (reservation.providerRefundId && ev.providerRefundId && ev.providerRefundId !== reservation.providerRefundId) {
          record("amount_mismatch"); return "amount_mismatch";
        }
        record("refund_accepted");
        tx.update(reservation.ref, {
          status: "accepted",
          providerRefundId: reservation.providerRefundId ?? ev.providerRefundId,
          projectionNeeded: true,
          updatedAt: now,
        });
        return "refund_accepted";
      }
    }
    // Unreserved external refund (provider dashboard): baseline handling below.
    // Truthful-state review of this path is still an explicit hold.
    const invSnap = payment.invoiceId ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId)) : null;
    const giftRefRefund = payment.targetType === "gift" && payment.giftId ? db.collection(COLLECTIONS.gifts()).doc(payment.giftId) : null;
    const giftSnapRefund = giftRefRefund ? await tx.get(giftRefRefund) : null;
    record("refunded");
    // A refunded gift payment (done in the Razorpay dashboard) stops the code working, unless the wash was already used.
    if (giftRefRefund && giftSnapRefund?.exists && (giftSnapRefund.data() as Gift).status !== "REDEEMED") {
      tx.update(giftRefRefund, { status: "REFUNDED", voidedAt: now, voidReason: "Payment refunded" });
      writeAuditLog(tx, { action: "gift.voided", entityType: "Gift", entityId: giftRefRefund.id, user, studioId: null, after: { reason: "payment_refunded" } });
    }
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
