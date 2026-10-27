// Admin-only cancel for a booking, with the fee and any refund decided here on the server.
// Cancel and refund are admin-only for now (owner decision); studio staff have no cancel.
//  - adminCancelBooking: preview=true returns the numbers and writes nothing. Otherwise it cancels in one go:
//    fee (policy fee or waived) is taken out of what was paid, the rest goes back through the payment provider,
//    credits come back (wash, member pickup, gift), the pickup request closes, the invoice is voided.
//    If the provider refuses, the booking is NOT cancelled and the claim is released.
//  - settleCancellationFee: marks a fee that is still due as collected or waived.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Booking, ServiceJob, Payment, Invoice } from "@autodeck/core";
import { cancellationTerms } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { extractUser, assertRole, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { planReserveInTx, applyReserveInTx, runRefundOutbox } from "../../lib/refund-outbox.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { planRefund, readCancelReads, writeCancelRestores } from "../../lib/cancel-booking.js";

const adminCancelSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
  /** charge = the customer asked late, the policy fee applies. waive = studio cancelled or goodwill. */
  feeAction: z.enum(["charge", "waive"]),
  preview: z.boolean().optional(),
}).strict();

const settleFeeSchema = z.object({
  bookingId: z.string().min(1),
  action: z.enum(["collected", "waived"]),
  note: z.string().trim().max(300).optional(),
}).strict();

const CANCELLABLE_JOB = ["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED"];


/** The one cancel path: fee, refund through the payment provider, credits back, slot released. Admin and customer share it. */
export async function runCancel(
  user: ReturnType<typeof extractUser>,
  data: { bookingId: string; reason: string; feeAction: "charge" | "waive"; preview?: boolean | undefined },
  actor: "admin" | "customer",
) {
    const db = getFirestore();
    const bookingRef = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
    const snap = await bookingRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = snap.data() as Booking;
    assertTenant(user, booking.tenantId);
    assertStudio(user, booking.studioId, "Booking");
    if (actor === "customer") {
      if (booking.customerId !== user.uid) throw new HttpsError("permission-denied", "Cannot cancel another customer's booking.");
    }
    if (booking.status === "CANCELLED") return { success: true, alreadyCancelled: true };
    if (booking.status === "COMPLETED" || booking.status === "EXPIRED") {
      throw new HttpsError("failed-precondition", `Cannot cancel a booking with status ${booking.status}.`);
    }

    const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(1).get();
    const job = jobsSnap.docs[0]?.data() as ServiceJob | undefined;
    if (job && !CANCELLABLE_JOB.includes(job.status)) {
      throw new HttpsError("failed-precondition", "Work has already started on this job, so the booking cannot be cancelled here.");
    }
    const paySnap = job
      ? await db.collection(COLLECTIONS.payments()).where("jobId", "==", job.id).where("status", "in", ["pending", "processing", "completed"]).limit(10).get()
      : null;
    const payDocs = paySnap?.docs ?? [];
    if (payDocs.some((d) => d.data()["status"] === "processing")) {
      throw new HttpsError("failed-precondition", "A payment is still processing on this booking. Wait for it to settle, then cancel.");
    }
    const completed = payDocs.filter((d) => d.data()["status"] === "completed");
    if (completed.length > 1) {
      throw new HttpsError("failed-precondition", "This booking has more than one payment. Cancel it by hand and refund each payment from Payments.");
    }
    const payment = completed[0]?.data() as Payment | undefined;

    let categories = booking.cancelCategories ?? [];
    if (!categories.length) {
      const svc = await db.collection(COLLECTIONS.services()).doc(booking.serviceId).get();
      categories = svc.exists ? [String((svc.data() as { category?: string }).category ?? "")] : [];
    }
    const terms = cancellationTerms({ categories, totalPaise: booking.totalAmount, scheduledAtMs: Date.parse(booking.scheduledAt), nowMs: Date.now() });
    const plan = planRefund({ paidPaise: payment?.amount ?? 0, feePaise: terms.feePaise, waive: data.feeAction === "waive" });
    const summary = { paidPaise: plan.paidPaise, policyFeePaise: terms.feePaise, feePaise: plan.feePaise, feeStatus: plan.feeStatus, refundPaise: plan.refundPaise, method: payment?.method ?? null };
    if (data.preview) return { preview: true, ...summary };

    const now = new Date().toISOString();
    const paymentRef = completed[0]?.ref;
    const needsRefund = plan.refundPaise > 0 && !!payment && !!paymentRef;

    // 1. Decide the refund path. Provider (Razorpay) refunds go through the
    // refund outbox: the single refund authority. The reservation is created
    // INSIDE the cancellation transaction below (planReserveInTx +
    // applyReserveInTx), so a refund can never survive for a booking that was
    // not cancelled and a cancellation can never lose its refund reservation.
    // A Razorpay payment missing its provider payment id is malformed: HOLD,
    // never pretend an offline (manual) refund. The reservation is drained
    // inline post-transaction (and re-drained by the admin outbox runner and
    // projected by the webhook), so it cannot strand the balance.
    // Cash/UPI/bank refunds settle outside the provider; the
    // studio returns the money by hand and this records that obligation
    // (deployed behavior, preserved explicitly by payment method).
    const providerRefund = needsRefund && payment?.method === "razorpay_payment_link";
    if (providerRefund && !payment?.razorpayPaymentId) {
      throw new HttpsError(
        "failed-precondition",
        "This Razorpay payment is missing its provider payment id, so its refund cannot be submitted or verified. The booking is NOT cancelled.",
      );
    }
    const manualRefund = needsRefund && !providerRefund;
    let refundRequestId: string | null = null;

    // 2b. Kill unpaid payment links BEFORE cancelling the booking: a live
    // link would let the customer pay into a cancelled booking. The provider
    // must confirm the link is dead first - a paid/partially paid link refuses
    // cancellation (verified Razorpay API semantics, 28 Oct 2026), which is the
    // fail-closed race signal. The booking is never cancelled on an
    // unconfirmed link. Never runs on preview (preview returns above).
    const pendingLinks = payDocs.filter((d) => {
      const pmt = d.data() as Payment;
      return pmt.status === "pending" && pmt.method === "razorpay_payment_link";
    });
    const cancelledLinkPaymentIds: string[] = [];
    for (const d of pendingLinks) {
      const pmt = d.data() as Payment;
      if (!pmt.razorpayPaymentLinkId) {
        throw new HttpsError(
          "failed-precondition",
          "This booking's unpaid payment link is missing its provider link id, so it cannot be closed safely. The booking is NOT cancelled.",
        );
      }
      const linkOutcome = await getPaymentProvider().cancelPaymentLink(pmt.razorpayPaymentLinkId);
      if (linkOutcome.outcome === "already_paid") {
        throw new HttpsError(
          "failed-precondition",
          "A payment just arrived on this booking's payment link. The booking is NOT cancelled - refresh and check the payment before cancelling.",
        );
      }
      if (linkOutcome.outcome === "in_progress") {
        throw new HttpsError(
          "unavailable",
          "The payment provider is still updating this booking's payment link. The booking is NOT cancelled - try again in a moment.",
        );
      }
      // "cancelled" or "already_inactive": the link is confirmed dead.
      cancelledLinkPaymentIds.push(d.id);
    }

    // 3. Cancel everything in one transaction.
    interface CommittedPlan { feePaise: number; feeStatus: string; refundPaise: number; paidPaise: number; policyFeePaise: number; manualRefund: boolean }
    const planBox: { committed: CommittedPlan | null } = { committed: null };
    await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(bookingRef)).data() as Booking | undefined;
      if (!fresh) throw new HttpsError("not-found", "Booking not found.");
      if (fresh.status === "CANCELLED") throw new HttpsError("failed-precondition", "This booking was just cancelled.");
      // Terminal-state and ownership revalidation INSIDE the transaction:
      // the pre-transaction checks used a snapshot that can stale before commit.
      if (fresh.status === "COMPLETED" || fresh.status === "EXPIRED") {
        throw new HttpsError("failed-precondition", `Cannot cancel a booking with status ${fresh.status}.`);
      }
      if (fresh.tenantId !== booking.tenantId || fresh.studioId !== booking.studioId) {
        throw new HttpsError("failed-precondition", "The booking's studio changed. Reload and try again.");
      }
      const jobs = await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(2));
      // Ambiguity fails closed: a second job for the same booking is a
      // data-integrity stop, never a silent pick.
      if (jobs.size > 1) throw new HttpsError("failed-precondition", "This booking has more than one job. Cancel it by hand.");
      const jobDoc = jobs.docs[0];
      const j = jobDoc?.data() as ServiceJob | undefined;
      if (j && !CANCELLABLE_JOB.includes(j.status)) throw new HttpsError("failed-precondition", "Work has already started on this job.");
      // Payment eligibility is re-derived INSIDE the transaction with the
      // same rules as the pre-transaction preview: a payment that appears,
      // starts processing, or completes between the preview read and this
      // commit must change the outcome, never slip past a stale choice.
      const pays = j ? await tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", j.id).where("status", "in", ["pending", "processing", "completed"]).limit(11)) : null;
      // Bounded overflow behavior: more records than the inspected page must
      // stop the cancellation, never let an unseen processing/completed
      // payment slip past the eligibility checks below.
      if ((pays?.size ?? 0) > 10) throw new HttpsError("failed-precondition", "This booking has too many payment records to cancel safely here. Cancel it by hand and refund each payment from Payments.");
      const txPayDocs = pays?.docs ?? [];
      if (txPayDocs.some((d) => d.data()["status"] === "processing")) {
        throw new HttpsError("failed-precondition", "A payment is still processing on this booking. Wait for it to settle, then cancel.");
      }
      const txCompleted = txPayDocs.filter((d) => d.data()["status"] === "completed");
      if (txCompleted.length > 1) {
        throw new HttpsError("failed-precondition", "This booking has more than one payment. Cancel it by hand and refund each payment from Payments.");
      }
      // Fresh financial truth INSIDE the transaction: the pre-transaction
      // plan was computed from a snapshot that a retry or a concurrent write
      // can stale. Terms, fee and refund sizing are recomputed here from the
      // fresh booking and the fresh payment document; nothing financial is
      // sized from the caller's pre-transaction reads.
      const txPaymentRef = txCompleted[0]?.ref ?? null;
      const freshPayment = txCompleted[0]?.data() as Payment | undefined;
      let txCategories = fresh.cancelCategories ?? [];
      if (!txCategories.length) {
        const svcSnap = await tx.get(db.collection(COLLECTIONS.services()).doc(fresh.serviceId));
        txCategories = svcSnap.exists ? [String((svcSnap.data() as { category?: string }).category ?? "")] : [];
      }
      const txTerms = cancellationTerms({ categories: txCategories, totalPaise: fresh.totalAmount, scheduledAtMs: Date.parse(fresh.scheduledAt), nowMs: Date.now() });
      const txPlan = planRefund({ paidPaise: freshPayment?.amount ?? 0, feePaise: txTerms.feePaise, waive: data.feeAction === "waive" });
      const txNeedsRefund = txPlan.refundPaise > 0 && !!freshPayment && !!txPaymentRef;
      const txProviderRefund = txNeedsRefund && freshPayment?.method === "razorpay_payment_link";
      const txManualRefund = txNeedsRefund && !txProviderRefund;
      if (txProviderRefund && !freshPayment?.razorpayPaymentId) {
        throw new HttpsError(
          "failed-precondition",
          "This Razorpay payment is missing its provider payment id, so its refund cannot be submitted or verified. The booking is NOT cancelled.",
        );
      }
      planBox.committed = { feePaise: txPlan.feePaise, feeStatus: txPlan.feeStatus, refundPaise: txPlan.refundPaise, paidPaise: txPlan.paidPaise, policyFeePaise: txTerms.feePaise, manualRefund: txManualRefund };
      const invoiceSnap = txNeedsRefund && freshPayment?.invoiceId ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(freshPayment.invoiceId)) : null;
      // Manual-obligation marker read BEFORE any write in this transaction:
      // an existing refund_<paymentId> doc (legacy claim or outbox tombstone)
      // means refund accounting already exists for this money - stop, never
      // double-record the obligation.
      const manualClaimRef = txManualRefund && txNeedsRefund && txPaymentRef ? db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${txPaymentRef.id}`) : null;
      const manualClaimSnap = manualClaimRef ? await tx.get(manualClaimRef) : null;
      if (manualClaimSnap?.exists) {
        throw new HttpsError("failed-precondition", "A refund record already exists for this payment. The booking is NOT cancelled; settle or inspect the existing refund first.");
      }
      // Shared ownership validation for BOTH refund methods (the provider
      // path's planner/runner checks never cover the manual path): the fresh
      // payment must belong to THIS booking, job, studio and tenant; the job
      // must agree on tenant/studio; a voided invoice must be the payment's
      // own same-tenant invoice. A same-tenant-but-wrong-link payment is a
      // stop, not a refund target.
      if (txNeedsRefund && freshPayment) {
        if (freshPayment.tenantId !== fresh.tenantId || freshPayment.studioId !== fresh.studioId) {
          throw new HttpsError("failed-precondition", "The payment does not belong to this booking's studio. The booking is NOT cancelled.");
        }
        if (freshPayment.bookingId !== data.bookingId) {
          throw new HttpsError("failed-precondition", "The payment is no longer linked to this booking. The booking is NOT cancelled.");
        }
        if ((freshPayment.jobId ?? null) !== (jobDoc?.id ?? null)) {
          throw new HttpsError("failed-precondition", "The payment is no longer linked to this booking's job. The booking is NOT cancelled.");
        }
        if (j && (j.tenantId !== fresh.tenantId || j.studioId !== fresh.studioId)) {
          throw new HttpsError("failed-precondition", "The job does not belong to this booking's studio. The booking is NOT cancelled.");
        }
        // The Invoice schema carries full linkage (paymentId/jobId/bookingId/
        // customerId/studioId/tenantId), so a voided invoice must be THIS
        // payment's own invoice on every axis - tenant equality alone is not
        // a binding.
        if (invoiceSnap?.exists) {
          const inv = invoiceSnap.data() as Invoice;
          if (inv.tenantId !== fresh.tenantId || inv.studioId !== fresh.studioId || inv.paymentId !== freshPayment.id || inv.jobId !== freshPayment.jobId || inv.bookingId !== data.bookingId || inv.customerId !== freshPayment.customerId) {
            throw new HttpsError("failed-precondition", "The invoice does not belong to this payment and booking. The booking is NOT cancelled.");
          }
        }
      }
      const reads = await readCancelReads(tx, db, fresh, data.bookingId);

      // Atomic refund reservation (provider payments only): planned and
      // applied INSIDE this transaction, after fresh booking/job eligibility
      // revalidation above. planReserveInTx re-reads the payment and its
      // related records transactionally; a concurrent cancellation, job
      // start, or payment change retries this transaction and refuses on the
      // fresh state, so no standalone runnable reservation can survive a
      // booking that was not cancelled. The expected booking/job binding
      // pins the refund to THIS cancellation: a payment re-linked elsewhere
      // since the snapshot is a refusal, never a redirect.
      if (txProviderRefund && txPaymentRef && freshPayment) {
        const reservePlan = await planReserveInTx(tx, db, {
          payment: freshPayment, amountPaise: txPlan.refundPaise, reason: data.reason, createdBy: user.uid,
          expectedBookingId: data.bookingId, expectedJobId: jobDoc?.id ?? null,
        });
        if (!reservePlan.ok) {
          throw new HttpsError("failed-precondition", `${reservePlan.reason} The booking is NOT cancelled.`);
        }
        refundRequestId = applyReserveInTx(tx, reservePlan).requestId;
      }

      for (const d of pays?.docs ?? []) {
        if (d.data()["status"] === "pending") {
          // Links the provider confirmed dead above close with a timestamp and
          // an audit trail; any other pending record keeps the deployed write.
          const providerClosed = cancelledLinkPaymentIds.includes(d.id);
          tx.update(d.ref, { status: "cancelled", ...(providerClosed ? { cancelledAt: now } : {}), updatedAt: now });
          if (providerClosed) {
            writeAuditLog(tx, {
              action: "payment.cancelled",
              entityType: "Payment",
              entityId: d.id,
              user,
              studioId: (d.data() as Payment).studioId ?? null,
              after: { status: "cancelled", via: "link_cancelled_on_booking_cancel" },
            });
          }
        }
      }
      writeCancelRestores(tx, reads, fresh, data.bookingId, user, now, `Booking cancelled by ${actor}: ${data.bookingId}`);

      // Cash/UPI/bank (manual) refunds settle outside the provider by hand.
      // TRUTHFUL PROJECTION (Booking.manualRefundDuePaise contract): at
      // cancel time the money is still in the studio's hands, so the payment
      // STAYS "completed" and the invoice STAYS issued - nothing here may
      // record money as returned before it physically is. The obligation is
      // written on the booking (manualRefundDuePaise; read by the admin owed
      // badge, the office refunds-owed report and the customer notice) and
      // marked with an unmarked refund_<paymentId> doc, the same "manual
      // refund obligation" marker refund-outbox.ts and initiateRefund.ts
      // already refuse to double-process. Settlement (office hands the money
      // back and records it) is a separate explicit action; this cancel path
      // deliberately does NOT perform it.
      if (txManualRefund && txNeedsRefund && txPaymentRef && freshPayment && manualClaimRef) {
        tx.set(manualClaimRef, { paymentId: txPaymentRef.id, claimedAt: now, claimedBy: user.uid, bookingId: data.bookingId, amount: txPlan.refundPaise, kind: "manual_refund_owed" });
      }
      // Provider refunds: this callable writes NO refund projection. The
      // outbox runner submits and projects truthfully (partial amounts stay
      // partial; the issued invoice is never voided by the projection -
      // credit-note treatment stays an accountant hold).
      if (jobDoc && j) {
        tx.update(jobDoc.ref, {
          status: "CANCELLED",
          statusHistory: [...j.statusHistory, { status: "CANCELLED", changedAt: now, changedBy: user.uid, notes: `Booking cancelled by admin: ${data.reason}` }],
          updatedAt: now,
        });
      }
      tx.update(bookingRef, {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: actor,
        cancellationReason: data.reason,
        cancellationFeePaise: txPlan.feePaise,
        ...(txPlan.feeStatus !== "none" ? { cancellationFeeStatus: txPlan.feeStatus } : {}),
        ...(txPlan.feeStatus === "waived" ? { cancellationFeeSettledBy: user.uid, cancellationFeeSettledAt: now } : {}),
        refundedPaise: 0,
        // Manual cancels: money is OWED, not returned - record the obligation,
        // leave paymentStatus/refundStatus untouched until a real settlement.
        ...(txManualRefund && txNeedsRefund ? { manualRefundDuePaise: txPlan.refundPaise } : {}),
        ...(refundRequestId ? { refundStatus: "requested", refundRequestId, refundRequestedPaise: txPlan.refundPaise } : {}),
        updatedAt: now,
      });
      writeAuditLog(tx, {
        action: "booking.cancelled",
        entityType: "Booking",
        entityId: data.bookingId,
        user,
        studioId: booking.studioId,
        before: { status: fresh.status },
        after: {
          status: "CANCELLED",
          cancellationReason: data.reason,
          cancellationFeePaise: txPlan.feePaise,
          // Truthful accounting: money OWED (manual, nothing returned yet -
          // the obligation is on manualRefundDuePaise) vs money REQUESTED
          // from the provider (projected later by the runner). refundedPaise
          // only ever counts money actually sent back: zero at cancel time.
          refundedPaise: 0,
          ...(txManualRefund && txNeedsRefund ? { manualRefundDuePaise: txPlan.refundPaise } : {}),
          ...(refundRequestId ? { refundRequestedPaise: txPlan.refundPaise } : {}),
          feeStatus: txPlan.feeStatus,
        },
        metadata: { cancelledBy: actor, refundRequestId },
      });
    });

    // Submission ownership: the reservation committed atomically with the
    // cancellation above, and a reservation emits NO provider event - so no
    // webhook can ever bootstrap its submission. THIS post-commit drain is
    // what actually submits the refund to the provider, scoped to exactly
    // the request just created. It runs after the commit (never inside the
    // retrying transaction) and is safe to re-run: the runner claims a
    // transactional lease, submits at most once, and reconciles through the
    // bound provider lookup. If it fails, the durable request stays reserved
    // with the failure written on it, reconcilable by the manual runner and
    // visible to the held-requests surface - the cancellation is never
    // rolled back for a drain error.
    if (refundRequestId) {
      try {
        await runRefundOutbox(db, getPaymentProvider(), { requestId: refundRequestId, runnerId: `cancel:${user.uid}` });
      } catch (err) {
        await db.collection(COLLECTIONS.refundRequests()).doc(refundRequestId).update({
          lastError: `post-cancellation refund submission failed: ${err instanceof Error ? err.message : String(err)}`,
          updatedAt: new Date().toISOString(),
        }).catch(() => undefined);
      }
    }

    // Respond with the plan the transaction actually committed (recomputed
    // from fresh records inside it), not the pre-transaction preview.
    const committed = planBox.committed;
    return { success: true, providerRefundId: null, paidPaise: committed?.paidPaise ?? summary.paidPaise, policyFeePaise: committed?.policyFeePaise ?? summary.policyFeePaise, feePaise: committed?.feePaise ?? summary.feePaise, feeStatus: committed?.feeStatus ?? summary.feeStatus, refundPaise: committed?.refundPaise ?? summary.refundPaise, method: summary.method, refundRequestId, manualRefund: committed?.manualRefund ?? manualRefund };
}

export const adminCancelBooking = onCall(
  { region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"], enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    assertRole(user, "admin", "superadmin");
    assertTenant(user, user.claims.tenantId);
    const data = validate(adminCancelSchema, request.data);
    if (!data.preview) await enforceRateLimit(subjectFrom(user), "booking.adminCancel");
    return runCancel(user, data, "admin");
  },
);

export const settleCancellationFee = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);
  const data = validate(settleFeeSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.settleFee");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
    const b = snap.data() as Booking;
    assertTenant(user, b.tenantId);
    assertStudio(user, b.studioId, "Booking");
    if (b.status !== "CANCELLED") throw new HttpsError("failed-precondition", "Only a cancelled booking has a cancellation fee.");
    if (!(b.cancellationFeePaise && b.cancellationFeePaise > 0)) throw new HttpsError("failed-precondition", "This booking has no cancellation fee.");
    if (b.cancellationFeeStatus !== "due") throw new HttpsError("failed-precondition", "This fee is already settled.");
    const now = new Date().toISOString();
    tx.update(ref, {
      cancellationFeeStatus: data.action,
      cancellationFeeSettledBy: user.uid,
      cancellationFeeSettledAt: now,
      ...(data.note ? { cancellationFeeNote: data.note } : {}),
      updatedAt: now,
    });
    writeAuditLog(tx, { action: "booking.cancel_fee_settled", entityType: "Booking", entityId: data.bookingId, user, studioId: b.studioId, before: { cancellationFeeStatus: "due" }, after: { cancellationFeeStatus: data.action, cancellationFeePaise: b.cancellationFeePaise } });
  });
  return { success: true };
});
