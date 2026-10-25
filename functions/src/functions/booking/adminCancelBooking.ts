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
import { isProductionProject } from "../../lib/environment.js";
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
    // never pretend an offline (manual) refund. While the runner's production
    // refusal holds, a cancellation that needs a provider refund refuses in
    // production too - a reservation with no runner to drain it would strand
    // the balance. Cash/UPI/bank refunds settle outside the provider; the
    // studio returns the money by hand and this records that obligation
    // (deployed behavior, preserved explicitly by payment method).
    const providerRefund = needsRefund && payment?.method === "razorpay_payment_link";
    if (providerRefund && !payment?.razorpayPaymentId) {
      throw new HttpsError(
        "failed-precondition",
        "This Razorpay payment is missing its provider payment id, so its refund cannot be submitted or verified. The booking is NOT cancelled.",
      );
    }
    if (providerRefund && isProductionProject()) {
      throw new HttpsError("unavailable", "Refunds on paid bookings are held for deploy-time activation review. The booking is NOT cancelled.");
    }
    const manualRefund = needsRefund && !providerRefund;
    let refundRequestId: string | null = null;

    // 3. Cancel everything in one transaction.
    await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(bookingRef)).data() as Booking | undefined;
      if (!fresh) throw new HttpsError("not-found", "Booking not found.");
      if (fresh.status === "CANCELLED") throw new HttpsError("failed-precondition", "This booking was just cancelled.");
      const jobs = await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(1));
      const jobDoc = jobs.docs[0];
      const j = jobDoc?.data() as ServiceJob | undefined;
      if (j && !CANCELLABLE_JOB.includes(j.status)) throw new HttpsError("failed-precondition", "Work has already started on this job.");
      const pays = j ? await tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", j.id).where("status", "in", ["pending", "completed"]).limit(10)) : null;
      const invoiceSnap = needsRefund && payment?.invoiceId ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId)) : null;
      const reads = await readCancelReads(tx, db, fresh, data.bookingId);

      // Atomic refund reservation (provider payments only): planned and
      // applied INSIDE this transaction, after fresh booking/job eligibility
      // revalidation above. planReserveInTx re-reads the payment and its
      // related records transactionally; a concurrent cancellation, job
      // start, or payment change retries this transaction and refuses on the
      // fresh state, so no standalone runnable reservation can survive a
      // booking that was not cancelled.
      if (providerRefund && paymentRef && payment) {
        const reservePlan = await planReserveInTx(tx, db, {
          payment, amountPaise: plan.refundPaise, reason: data.reason, createdBy: user.uid,
        });
        if (!reservePlan.ok) {
          throw new HttpsError("failed-precondition", `${reservePlan.reason} The booking is NOT cancelled.`);
        }
        refundRequestId = applyReserveInTx(tx, reservePlan).requestId;
      }

      for (const d of pays?.docs ?? []) {
        if (d.data()["status"] === "pending") tx.update(d.ref, { status: "cancelled", updatedAt: now });
      }
      writeCancelRestores(tx, reads, fresh, data.bookingId, user, now, `Booking cancelled by ${actor}: ${data.bookingId}`);

      if (manualRefund && needsRefund && paymentRef && payment) {
        tx.update(paymentRef, { status: "refunded", razorpayRefundId: null, refundAmount: plan.refundPaise, refundedAt: now, updatedAt: now });
        if (invoiceSnap?.exists && (invoiceSnap.data() as Invoice).status !== "void" && payment.invoiceId) {
          tx.update(invoiceSnap.ref, { status: "void", voidedAt: now, voidedReason: `Booking cancelled: ${data.reason}`, updatedAt: now });
        }
      }
      // Provider refunds: this callable writes NO refund projection. The
      // outbox runner submits and projects truthfully (partial amounts stay
      // partial; the issued invoice is never voided by the projection -
      // credit-note treatment stays an accountant hold).
      if (jobDoc && j) {
        tx.update(jobDoc.ref, {
          status: "CANCELLED",
          ...(manualRefund && needsRefund ? { paymentStatus: "refunded" } : {}),
          statusHistory: [...j.statusHistory, { status: "CANCELLED", changedAt: now, changedBy: user.uid, notes: `Booking cancelled by admin: ${data.reason}` }],
          updatedAt: now,
        });
      }
      tx.update(bookingRef, {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: actor,
        cancellationReason: data.reason,
        cancellationFeePaise: plan.feePaise,
        ...(plan.feeStatus !== "none" ? { cancellationFeeStatus: plan.feeStatus } : {}),
        ...(plan.feeStatus === "waived" ? { cancellationFeeSettledBy: user.uid, cancellationFeeSettledAt: now } : {}),
        refundedPaise: manualRefund && needsRefund ? plan.refundPaise : 0,
        ...(manualRefund && needsRefund ? { paymentStatus: "refunded", refundStatus: "initiated", refundId: null } : {}),
        ...(refundRequestId ? { refundStatus: "requested", refundRequestId, refundRequestedPaise: plan.refundPaise } : {}),
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
          cancellationFeePaise: plan.feePaise,
          // Truthful accounting: money RETURNED (manual, recorded now) vs
          // money REQUESTED from the provider (projected later by the runner).
          refundedPaise: manualRefund && needsRefund ? plan.refundPaise : 0,
          ...(refundRequestId ? { refundRequestedPaise: plan.refundPaise } : {}),
          feeStatus: plan.feeStatus,
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

    return { success: true, ...summary, refundRequestId, manualRefund };
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
