import{readConsultPaymentBinding,assertPaymentConsultBinding}from"./consult-payment.js";
import{isDeepStrictEqual}from "node:util";
import {readCombinedPaymentBasis,assertCombinedSettlementPayment,type CombinedPaymentBasis}from "./combined-settlement.js";
import {checkedCombinedPayment}from "@autodeck/core";
import { resolveWaitingCancel } from "./waiting-cancel.js";
import { isHoldExpired } from "./booking-hold.js";
// Applies a verified payment-provider event to Firestore. Pure of HTTP: the
// onRequest wrapper verifies the signature and calls processProviderEvent().
//
// Safe to receive the same event many times, and events out of order:
//  - every event id is claimed once in paymentEvents (inside the transaction);
//  - payment.link.paid and payment.captured both arrive for one payment, the
//    second one finds the payment already completed and changes nothing;
//  - the amount in the event must equal the stored payment amount, otherwise
//    nothing is marked paid and the event is recorded for review.
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Booking, Gift, Invoice, Membership, Payment, ServiceJob } from "@autodeck/core";
import { planReserveInTx, applyReserveInTx } from "./refund-outbox.js";
import { planGiftActivation } from "./gift-activate.js";
import { readUpgradeSource, endUpgradedMembership } from "./membership-upgrade.js";
import { readMembershipForRefund, deactivateRefundedMembershipInTx, alertMembershipPartialRefundInTx, readUpgradePredecessorForRefund, restoreUpgradedPredecessorInTx } from "./membership-refund.js";
import { MEMBERSHIP_DURATION_DAYS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import type { AuthorizedUser } from "@autodeck/auth";
import type { ProviderWebhookEvent, CancelPaymentLinkResult } from "./payment-provider.js";
import { writeAuditLog } from "../middleware/audit.js";
import { prepareJobInvoice } from "./job-invoice.js";
import { runRefundOutbox, adoptProcessedRefundEvidence } from "./refund-outbox.js";
import { getPaymentProvider } from "./razorpay-provider.js";

export type WebhookOutcome =
  | "completed"
  | "link_expired"
  | "link_cancelled"
  | "failed"
  | "refunded"
  | "duplicate"
  | "already_final"
  | "unknown_payment"
  | "amount_mismatch"
  | "outbox_owned"
  | "overpayment_review"
  | "old_link_capture"
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
  // ADDITIVE fallback (reviewer G2/G3): a late capture on a SUPERSEDED
  // advance link/order still resolves to its payment via the append-only
  // history. Only runs when every current-binding lookup missed, so
  // existing membership/gift/job resolution is unchanged.
  if (ev.providerPaymentLinkId) {
    const q = await col.where("priorLinkIds", "array-contains", ev.providerPaymentLinkId).limit(1).get();
    if (!q.empty) return q.docs[0]!.data() as Payment;
  }
  if (ev.providerOrderId) {
    const q = await col.where("priorOrderIds", "array-contains", ev.providerOrderId).limit(1).get();
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
  hooks?: { cancelLink?: (providerPaymentLinkId: string) => Promise<CancelPaymentLinkResult> },
): Promise<{ outcome: WebhookOutcome; paymentId: string | null }> {
  const eventRef = db.collection(COLLECTIONS.paymentEvents()).doc(ev.providerEventId);
  const handled: ProviderWebhookEvent["eventType"][] = [
    // "payment_link.paid" is the name Razorpay actually documents and emits for payment links
    // (https://razorpay.com/docs/webhooks/payment-links); "payment.link.paid" is kept so any
    // endpoint already subscribed to the legacy name keeps working.
    "payment.captured", "payment.link.paid", "payment_link.paid", "payment.failed", "refund.created", "refund.processed",
    // Link terminal events are routed so a waiting cancel can see them; they never act on their own
    // (see below): a link expiring/cancelling is not proof that an in-progress payment cannot capture.
    "payment_link.expired", "payment_link.cancelled",
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
    if (ev.eventType === "payment.captured" || ev.eventType === "payment_link.paid") {
      const id = `unmatched_capture_${ev.providerEventId}`;
      await db.collection(COLLECTIONS.staffAlerts()).doc(id).set({ id, kind: "unmatched_payment_capture", tenantId: null, studioId: null, providerEventId: ev.providerEventId, providerPaymentId: ev.providerPaymentId ?? null, providerPaymentLinkId: ev.providerPaymentLinkId ?? null, providerOrderId: ev.providerOrderId ?? null, referenceId: ev.referenceId ?? null, amount: ev.amount, currency: ev.currency, createdAt: new Date().toISOString(), reason: "Verified provider capture has no matching Payment. Reconcile before any new collection." });
    }
    return { outcome: "unknown_payment", paymentId: null };
  }

  const paymentRef = db.collection(COLLECTIONS.payments()).doc(found.id);
  const user = systemUser(found.tenantId);
  const now = new Date().toISOString();
  const isPaid =
    ev.eventType === "payment.captured" || ev.eventType === "payment.link.paid" || ev.eventType === "payment_link.paid";

  let cancelLinkId: string | null = null;
  const outcome = await db.runTransaction(async (tx): Promise<WebhookOutcome> => {
    // ---- reads ----
    const evSnap = await tx.get(eventRef);
    if (evSnap.exists) return "duplicate";
    const paySnap = await tx.get(paymentRef);
    const payment = paySnap.data() as Payment;
    const record = (o: WebhookOutcome) =>
      tx.set(eventRef, { eventType: ev.eventType, paymentId: payment.id, outcome: o, processedAt: now });

    // A cancel requested while this payment was in progress (24 Oct ruling #2) is resolved
    // by the verified provider result before any ordinary handling.
    const waiting = await resolveWaitingCancel(tx, db, payment, ev, now);
    if (waiting) { record(waiting); return waiting; }
    if (ev.eventType === "payment_link.expired" || ev.eventType === "payment_link.cancelled") {
      // Advance links (targetType "booking", PREVIEW): an expired/cancelled
      // link means the stored paymentUrl is dead. Leaving it would strand
      // the customer on a URL that can never be paid (reviewer W3). Clear
      // the URL so the next request reconciles with the provider (old link
      // confirmed inactive) before any fresh link is created. The provider
      // link id is KEPT for that reconciliation. Not a payment event: no
      // money moved, payment stays pending.
      const isTerminalLink = ev.eventType === "payment_link.expired" ? "link_expired" as const : "link_cancelled" as const;
      if (payment.targetType === "booking" && (payment.status === "pending" || payment.status === "processing") && payment.paymentUrl) {
        record(isTerminalLink);
        tx.update(paymentRef, { paymentUrl: null, updatedAt: now });
        writeAuditLog(tx, { action: "payment.advance_link_expired", entityType: "Payment", entityId: payment.id, user, studioId: payment.studioId,
          after: { paymentUrl: null, via: "razorpay_webhook", eventType: ev.eventType } });
        return isTerminalLink;
      }
      record("ignored"); return "ignored";
    }

    if (isPaid) {
      if ((payment.targetType === "membership" || payment.targetType === "gift") && (payment.status === "completed" || payment.status === "refunded") && ev.providerPaymentId && payment.razorpayPaymentId && ev.providerPaymentId !== payment.razorpayPaymentId) {
        record("overpayment_review");
        tx.update(paymentRef, { invoiceReviewNeeded: true, updatedAt: now });
        const alert = db.collection(COLLECTIONS.staffAlerts()).doc(`extra_capture_${ev.providerPaymentId}`);
        tx.set(alert, { id: alert.id, kind: "extra_payment_capture", tenantId: payment.tenantId, studioId: null, paymentId: payment.id, providerPaymentId: ev.providerPaymentId, amount: ev.amount, currency: ev.currency, createdAt: now, reason: "A different capture arrived on an already settled payment. Reconcile manually; no automatic refund." });
        return "overpayment_review";
      }
      if (payment.status === "completed" && payment.targetType === "membership" && payment.membershipId) {
        // Mixed-vintage rollout repair (same 24 Oct ruling #5 scope as the late-capture reservation below): an OLDER instance can
        // complete a capture for a cancelled/expired membership with no reservation and no alert, and this newer code would then
        // see "already final" and leave the money stranded. Only a payment PROVEN late is repaired: it completed AFTER the
        // membership was cancelled (cancelledAt), or after an expired membership's end date. A payment that completed first and
        // was cancelled/expired later is a normal paid membership and is never touched. Missing/unparseable evidence = no repair.
        const mRef0 = db.collection(COLLECTIONS.memberships()).doc(payment.membershipId);
        const [m0, a0] = await Promise.all([tx.get(mRef0), tx.get(db.collection(COLLECTIONS.staffAlerts()).doc(`late_membership_payment_${payment.id}`))]);
        const m = m0.exists ? (m0.data() as Membership) : null;
        const doneAt = Date.parse(payment.completedAt ?? "");
        const provenLate = !!m && Number.isFinite(doneAt) && !a0.exists && payment.tenantId === m.tenantId && (
          (m.status === "cancelled" && !!m.cancelledAt && Number.isFinite(Date.parse(m.cancelledAt)) && doneAt > Date.parse(m.cancelledAt)) ||
          (m.status === "expired" && !!m.endDate && Number.isFinite(Date.parse(m.endDate)) && doneAt > Date.parse(m.endDate) + 86400000));
        const plan = provenLate ? await planReserveInTx(tx, db, { payment, amountPaise: payment.amount, reason: "late_membership_payment", createdBy: "system" }) : null;
        record("already_final");
        if (plan) {
          const alertRef = db.collection(COLLECTIONS.staffAlerts()).doc(`late_membership_payment_${payment.id}`);
          if (plan.ok) applyReserveInTx(tx, plan);
          tx.set(alertRef, { id: alertRef.id, tenantId: payment.tenantId, studioId: payment.studioId ?? null,
            kind: plan.ok ? "late_membership_payment" : plan.code === "same_reservation" ? "late_membership_already_reserved" : "late_membership_refund_not_reserved",
            paymentId: payment.id, createdAt: now, repairedAfterCompletion: true,
            ...(plan.ok ? {} : { reservationOutcome: plan.code, reason: "late_membership_payment", owedAmountPaise: payment.amount > 0 ? payment.amount : null, currency: payment.currency ?? null }) });
        }
        return "already_final";
      }
      if (payment.targetType === "booking" && (payment.status === "completed" || payment.status === "refunded")
          && !!ev.providerPaymentId && !!payment.razorpayPaymentId && ev.providerPaymentId !== payment.razorpayPaymentId) {
        // DISTINCT second capture on a settled advance (reviewer G3): real
        // extra money, NOT provider redelivery - a redelivered SAME capture
        // keeps the same providerPaymentId and stays on the idempotent
        // already_final path below. Keep the original completion and its
        // capture identity intact, record the extra capture's own identity
        // and amount, flag the office review queue. Never flattened into a
        // silent already_final.
        record("overpayment_review");
        // APPEND, never overwrite (main 2 Nov): operational review needs
        // EVERY extra capture's identity, not just the latest slot.
        tx.update(paymentRef, { invoiceReviewNeeded: true,
          overpayments: FieldValue.arrayUnion({ providerPaymentId: ev.providerPaymentId, amount: ev.amount ?? null, currency: ev.providerPaymentEntityCurrency ?? null, at: now }),
          updatedAt: now });
        writeAuditLog(tx, { action: "payment.overpayment_flagged", entityType: "Payment", entityId: payment.id, user, studioId: payment.studioId,
          after: { overpaymentProviderPaymentId: ev.providerPaymentId, originalProviderPaymentId: payment.razorpayPaymentId } });
        return "overpayment_review";
      }
      if (payment.status === "completed" || payment.status === "refunded") { record("already_final"); return "already_final"; }
      if (!Number.isSafeInteger(ev.amount) || ev.amount<=0 || ev.amount !== payment.amount || ev.currency!==payment.currency) { record("amount_mismatch"); return "amount_mismatch"; }

      if (payment.targetType === "membership") {
        const mRef = payment.membershipId ? db.collection(COLLECTIONS.memberships()).doc(payment.membershipId) : null;
        const mSnap = mRef ? await tx.get(mRef) : null;
        // Late capture (owner ruling 24 Oct 2026 #5, user "5 - you suggest" 09:53:57 IST, pick "Auto-refund + alert" 09:54:23, go 10:37:38):
        // a payment captured for a membership that is already cancelled or expired never activates it. A FULL refund RESERVATION is
        // planned here (reads) and committed in THIS transaction with the payment completion and the event doc, so they land together
        // or not at all, plus a staff alert. Reservation only: no provider call here; the outbox runner submits it as for any refund.
        const lateMembership = !!(mSnap?.exists && ["cancelled", "expired"].includes((mSnap.data() as Membership).status));
        const reservePlan = lateMembership
          ? await planReserveInTx(tx, db, { payment, amountPaise: payment.amount, reason: "late_membership_payment", createdBy: "system", completingInThisTx: true })
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
        if (!plan.activate) {
          tx.update(paymentRef, { invoiceReviewNeeded: true });
          const alert = db.collection(COLLECTIONS.staffAlerts()).doc(`gift_capture_review_${payment.id}`);
          tx.set(alert, { id: alert.id, tenantId: payment.tenantId, studioId: null, kind: "gift_manual_review", paymentId: payment.id, giftId: payment.giftId ?? null, reason: plan.reason, createdAt: now });
        }
        if (gRef && plan.activate) {
          tx.update(gRef, plan.patch);
          writeAuditLog(tx, { action: "gift.activated", entityType: "Gift", entityId: gRef.id, user, studioId: null,
            before: { status: "PENDING_PAYMENT" }, after: { status: "ACTIVE", expiresAt: plan.patch.expiresAt, via: "payment_verified" } });
        }
        return "completed";
      }

      if (payment.targetType === "booking") {
        // Pay-at-studio ADVANCE (basket item 4, PREVIEW - no such Payment can
        // exist while ADVANCE_PAYMENT_ENABLED is false). Money arrived
        // against a booking, not a job: complete the payment and mark the
        // booking advance-paid. Deliberately NO status flip, no invoice, no
        // job - the studio still does the work and settles the balance via
        // the existing job/invoice lifecycle. Duplicates and amount
        // mismatches are already stopped above (already_final /
        // amount_mismatch). Anomalies (booking gone or cancelled, advance
        // already marked) still complete the payment - the money IS
        // received - but touch nothing else and go to the office
        // refund-review queue, never silent retention.
        // Currency binding (reviewer F2, scoped to the advance branch so the
        // membership/gift/job paths are untouched): compare the PRESENCE-
        // PRESERVING raw entity currency (null when the provider payload had
        // none) - ev.currency is parser-defaulted to INR and would mask a
        // missing currency. Missing or mismatched fails CLOSED.
        if (!ev.providerPaymentEntityCurrency || ev.providerPaymentEntityCurrency !== payment.currency) {
          record("amount_mismatch"); return "amount_mismatch";
        }
        // Money arriving on a SUPERSEDED link/order (reviewer G3): the
        // capture references a prior link/order id than the currently
        // payable one. Complete THIS payment with the ACTUAL capture
        // identity (money is received), flag the office review queue, do
        // NOT mark the booking advance-paid (a human verifies which payment
        // stands), and hand the current payable link id out for a
        // post-commit provider cancel so the customer cannot ALSO pay it
        // (no blind silent double collection).
        const staleRef =
          (!!ev.providerPaymentLinkId && !!payment.razorpayPaymentLinkId && ev.providerPaymentLinkId !== payment.razorpayPaymentLinkId) ||
          (!!ev.providerOrderId && !!payment.razorpayOrderId && ev.providerOrderId !== payment.razorpayOrderId);
        if (staleRef) {
          record("old_link_capture");
          cancelLinkId = payment.razorpayPaymentLinkId;
          tx.update(paymentRef, { status: "completed", razorpayPaymentId: ev.providerPaymentId || payment.razorpayPaymentId,
            providerEventId: ev.providerEventId, completedAt: now, invoiceReviewNeeded: true, updatedAt: now });
          writeAuditLog(tx, { action: "payment.advance_old_link_capture", entityType: "Payment", entityId: payment.id, user, studioId: payment.studioId,
            after: { status: "completed", via: "razorpay_webhook" },
            metadata: { needsReview: "old_link_capture", captureProviderPaymentId: ev.providerPaymentId ?? null,
              captureProviderLinkId: ev.providerPaymentLinkId ?? null, captureProviderOrderId: ev.providerOrderId ?? null,
              currentProviderLinkId: payment.razorpayPaymentLinkId ?? null } });
          return "old_link_capture";
        }
        const bRef = payment.bookingId ? db.collection(COLLECTIONS.bookings()).doc(payment.bookingId) : null;
        const bSnap = bRef ? await tx.get(bRef) : null;
        const bk = bSnap?.exists ? (bSnap.data() as Booking) : undefined;
        // Tenant/studio binding (reviewer F1): a booking outside the
        // payment's tenant/studio must never be mutated by this payment.
        // Money is still recorded as received and flagged for review.
        // R3 (main 2 Nov): the advance confirms ONLY the matching ACTIVE
        // HELD booking. The 15-minute hold reserved capacity at creation;
        // an EXPIRED hold means the sweep may release the slot, so money
        // landing now is recorded but the booking is NOT confirmed - the
        // office queue reconciles (capacity + refund), never silent.
        const combinedJobs=bk?.combinedPayment&&payment.bookingId?await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId","==",payment.bookingId).limit(2)):null;
        const combinedJob=combinedJobs?.size===1?combinedJobs.docs[0]!.data()as ServiceJob:undefined;
        let combinedAnomaly:string|null=null;
        if(bk?.combinedPayment){try{const cp=checkedCombinedPayment(bk.combinedPayment,bk.totalAmount);if(cp.choice!=="advance20"||cp.payNowPaise!==payment.amount||bk.advancePaymentId!==payment.id||bk.customerId!==payment.customerId||!combinedJob||combinedJob.tenantId!==bk.tenantId||combinedJob.studioId!==bk.studioId||combinedJob.customerId!==bk.customerId||combinedJob.totalAmount!==bk.totalAmount||combinedJob.status==="CANCELLED"||combinedJob.paymentStatus==="paid"||!isDeepStrictEqual(combinedJob.combinedPayment,bk.combinedPayment))combinedAnomaly="combined_advance_binding";}catch{combinedAnomaly="combined_advance_snapshot";}}
        if(bk?.combinedPayment&&(bk as Booking&{quoteJourneyId?:string}).quoteJourneyId&&combinedJob&&!combinedAnomaly){try{await readConsultPaymentBinding(db,tx,combinedJob,bk as unknown as Record<string,unknown>)}catch{combinedAnomaly="combined_quote_approval_changed"}}
        const holdExpired = !!bk && bk.status === "PENDING" && isHoldExpired(bk, Date.parse(now));
        const anomaly = !bk ? "booking_missing"
          : bk.tenantId !== payment.tenantId ? "tenant_mismatch"
          : (bk.studioId ?? null) !== (payment.studioId ?? null) ? "studio_mismatch"
          : bk.status === "CANCELLED" ? "booking_cancelled"
          : bk.status === "EXPIRED" ? "advance_hold_expired"
          : combinedAnomaly ? combinedAnomaly
          : bk.advancePaidAt ? "advance_already_paid"
          : holdExpired ? "advance_hold_expired"
          : null;
        record("completed");
        tx.update(paymentRef, { status: "completed", razorpayPaymentId: ev.providerPaymentId || payment.razorpayPaymentId,
          providerEventId: ev.providerEventId, completedAt: now,
          ...(anomaly ? { invoiceReviewNeeded: true } : {}),
          updatedAt: now });
        writeAuditLog(tx, { action: "payment.completed", entityType: "Payment", entityId: payment.id, user, studioId: payment.studioId,
          after: { status: "completed", targetType: "booking", bookingId: payment.bookingId, via: "razorpay_webhook" },
          ...(anomaly ? { metadata: { needsReview: anomaly } } : {}) });
        if (!anomaly && bRef && bk) {
          if(bk.combinedPayment&&combinedJobs?.size===1){tx.update(combinedJobs.docs[0]!.ref,{paymentStatus:"partial",combinedSettlement:{advancePaymentId:payment.id,advanceCapturedPaise:payment.amount,balanceDuePaise:bk.totalAmount-payment.amount,settlementPaymentId:null,settledAt:null},updatedAt:now});}

          if (bk.status === "PENDING") {
            // Active held booking: confirm it (capacity was reserved by the
            // hold), clear the hold, mark advance-paid - one transition.
            tx.update(bRef, { status: "CONFIRMED", confirmedAt: now, holdExpiresAt: null, advancePaidAt: now,...(bk.combinedPayment?{paymentStatus:"partial"}:{}), updatedAt: now });
            writeAuditLog(tx, { action: "booking.confirmed", entityType: "Booking", entityId: bRef.id, user, studioId: payment.studioId,
              before: { status: "PENDING" }, after: { status: "CONFIRMED", advancePaidAt: now, paymentId: payment.id, via: "razorpay_webhook" } });
          } else {
            // Pre-activation vintage (CONFIRMED without the hold): marker
            // only, the status lifecycle is unchanged.
            tx.update(bRef, { advancePaidAt: now,...(bk.combinedPayment?{paymentStatus:"partial"}:{}), updatedAt: now });
            writeAuditLog(tx, { action: "booking.advance_paid", entityType: "Booking", entityId: bRef.id, user, studioId: payment.studioId,
              after: { advancePaidAt: now, paymentId: payment.id, via: "razorpay_webhook" } });
          }
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
      let combinedBasis:CombinedPaymentBasis|null=null,combinedAnomaly:string|null=null;
      if(job?.combinedPayment){try{combinedBasis=await readCombinedPaymentBasis(db,tx,job);assertCombinedSettlementPayment(job,payment,combinedBasis);}catch{combinedAnomaly="combined_balance_needs_review";}}
      let consultMismatch=false;if(job){try{const binding=await readConsultPaymentBinding(db,tx,job,booking as unknown as Record<string,unknown>|undefined);assertPaymentConsultBinding(payment,binding);}catch{consultMismatch=true;}}
      const anomaly = consultMismatch ? 'consult_approval_mismatch' : !job ? "job_missing" : job.status === "CANCELLED" ? "job_cancelled" : job.paymentStatus === "paid" ? "job_already_paid" : (job as ServiceJob & {cashReconciliationId?:string}).cashReconciliationId || job.offlineSettlement ? "cash_receipt_reconciliation" : combinedAnomaly;
      const prepared = job && !anomaly ? await prepareJobInvoice(db, tx, job, payment.id) : null;
      record("completed");
      if (!job || anomaly || !prepared || prepared.existing) {
        tx.update(paymentRef, { status: "completed", razorpayPaymentId: ev.providerPaymentId || payment.razorpayPaymentId,
          providerEventId: ev.providerEventId, completedAt: now,
          // Money that arrives against a gone, cancelled or already-settled job
          // is never ours to keep silently: flag every anomaly into the office
          // refund-review queue (listRefundWork / RefundWorkPanel read
          // invoiceReviewNeeded). The office returns it through the normal
          // authorized refund route; the refund projection clears the flag.
          // No automatic money movement.
          ...(anomaly ? { invoiceReviewNeeded: true } : {}),
          updatedAt: now });
        writeAuditLog(tx, { action: "payment.completed", entityType: "Payment", entityId: payment.id, user, studioId: payment.studioId,
          after: { status: "completed", via: "razorpay_webhook" }, metadata: { needsReview: anomaly ?? "invoice_exists" } });
        return "completed";
      }
      const { invoiceRef, invoice } = prepared;
      if(combinedBasis?.advancePaymentId){invoice.paymentAllocation={advancePaymentId:combinedBasis.advancePaymentId,advancePaidPaise:combinedBasis.advanceCapturedPaise,settlementPaymentId:payment.id,settlementPaidPaise:payment.amount};tx.update(db.collection(COLLECTIONS.payments()).doc(combinedBasis.advancePaymentId),{invoiceId:invoiceRef.id,updatedAt:now});}
      tx.update(paymentRef, { status: "completed", razorpayPaymentId: ev.providerPaymentId || payment.razorpayPaymentId,
        invoiceId: invoiceRef.id, providerEventId: ev.providerEventId, completedAt: now, updatedAt: now });
      tx.set(invoiceRef, invoice);
      tx.update(jobRef, { paymentStatus: "paid",...(combinedBasis?{combinedSettlement:{advancePaymentId:combinedBasis.advancePaymentId,advanceCapturedPaise:combinedBasis.advanceCapturedPaise,balanceDuePaise:0,settlementPaymentId:payment.id,settledAt:now}}:{}),updatedAt: now });
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
    // Owner policy 30 Oct 2026: a full refund of a membership payment ends that
    // membership's benefits - read the membership BEFORE any write (all-reads-first).
    const membershipRefund = await readMembershipForRefund(tx, db, payment);
    const upgradePredecessor = await readUpgradePredecessorForRefund(tx, db, membershipRefund);
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
    if(booking?.combinedPayment){tx.update(paymentRef,{invoiceReviewNeeded:true,updatedAt:now});record('related_mismatch');return 'related_mismatch';}
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
    // Membership policy (Meet, 30 Oct 2026): FULL refund ends that membership's
    // benefits; only this payment's own membership is touched. A partial refund
    // (not offered for memberships) changes no membership and alerts staff.
    if (membershipRefund) {
      if (fullyRefunded) {
        deactivateRefundedMembershipInTx(tx, membershipRefund, payment, now);
        restoreUpgradedPredecessorInTx(tx, db, upgradePredecessor, { id: membershipRefund.ref.id, tenantId: membershipRefund.data.tenantId, customerId: membershipRefund.data.customerId, washesUsed: membershipRefund.data.washesUsed }, payment, now);
      } else alertMembershipPartialRefundInTx(tx, db, payment, now);
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

  // Post-commit (reviewer G3): money arrived on a superseded link while a
  // CURRENT link may still be payable - cancel it at the provider now so
  // nothing double-collects. The cancel OUTCOME is recorded on a staff
  // alert either way (including already_paid, which means double money and
  // needs the office queue, and in_progress, which needs a retry eyeball).
  // Never silent. Outside the transaction: no provider calls inside a tx.
  if (outcome === "old_link_capture" && cancelLinkId && hooks?.cancelLink) {
    const alertRef = db.collection(COLLECTIONS.staffAlerts()).doc(`advance_old_link_capture_${found.id}`);
    try {
      const res = await hooks.cancelLink(cancelLinkId);
      await alertRef.set({ id: alertRef.id, tenantId: found.tenantId, studioId: found.studioId ?? null,
        kind: "advance_old_link_capture", paymentId: found.id, cancelledProviderLinkId: cancelLinkId,
        cancelOutcome: res.outcome,
        // Actionable ops retry (main 2 Nov): anything but a confirmed
        // cancel names the exact retry so the link cannot stay payable.
        ...(res.outcome !== "cancelled" ? { retryAction: "cancel_provider_link" } : {}),
        createdAt: new Date().toISOString() });
    } catch (e) {
      await alertRef.set({ id: alertRef.id, tenantId: found.tenantId, studioId: found.studioId ?? null,
        kind: "advance_old_link_capture_cancel_failed", paymentId: found.id, cancelledProviderLinkId: cancelLinkId,
        retryAction: "cancel_provider_link",
        error: e instanceof Error ? e.message : String(e), createdAt: new Date().toISOString() });
    }
  }
  return { outcome, paymentId: found.id };
}
