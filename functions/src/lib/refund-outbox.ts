// Booking-refund outbox: reserve -> submit to provider -> reconcile/projection.
//
// Why an outbox: a provider refund is an external side effect that must happen
// exactly once, and Firestore transactions retry — so the two are sequenced
// through a durable request record instead of one fragile call.
//
//  - reserveRefund: one active reservation per payment; rejects amounts that
//    would over-refund.
//  - runRefundOutbox: submits reserved requests to the provider (mock in
//    dev/emulator; never wired to a scheduler or production adapter), then
//    projects truthful state onto the payment/job/booking in one transaction.
//  - Crash safety: a request that reached the provider but was never
//    projected keeps projectionNeeded=true; the next run projects WITHOUT
//    resubmitting to the provider.
//
// Held, deliberately: the issued-invoice/credit-note/tax treatment of a
// refund (owner's accountant decides) — the runner never voids an invoice and
// marks the hold explicitly instead.
import type { Firestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import type { PaymentProvider } from "./payment-provider.js";
import { verifyRefundAccounting } from "./refund-accounting.js";

export type RefundRequestStatus = "reserved" | "submitted" | "accepted" | "projected" | "failed";

export interface RefundRequest {
  id: string;
  tenantId: string;
  studioId: string | null;
  paymentId: string;
  jobId: string | null;
  bookingId: string | null;
  amountPaise: number;
  reason: string;
  status: RefundRequestStatus;
  providerRefundId: string | null;
  projectionNeeded: boolean;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function requestsCol(db: Firestore) {
  return db.collection(COLLECTIONS.refundRequests());
}

/** Remaining refundable paise on a payment (captured minus already refunded). */
export function refundablePaise(payment: Payment): number {
  if (payment.status !== "completed" && payment.status !== "partially_refunded") return 0;
  return Math.max(0, payment.amount - (payment.refundAmount ?? 0));
}

export async function activeReservation(db: Firestore, paymentId: string): Promise<(RefundRequest & { ref: FirebaseFirestore.DocumentReference }) | null> {
  const snap = await requestsCol(db).where("paymentId", "==", paymentId).get();
  for (const doc of snap.docs) {
    const r = doc.data() as RefundRequest;
    if (r.status === "reserved" || r.status === "submitted" || r.status === "accepted") {
      return { ...r, ref: doc.ref };
    }
  }
  return null;
}

/**
 * Reserves a refund for a payment. One active reservation per payment; the
 * amount must fit inside what is still refundable. Returns the new request id.
 */
export async function reserveRefund(
  db: Firestore,
  i: { payment: Payment; amountPaise: number; reason: string; createdBy: string },
): Promise<{ requestId: string }> {
  const amount = Math.round(i.amountPaise);
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("refund amount must be a positive integer (paise)");
  if (amount > refundablePaise(i.payment)) {
    throw new Error(`refund of ${amount} exceeds the refundable ${refundablePaise(i.payment)} on payment ${i.payment.id}`);
  }
  const active = await activeReservation(db, i.payment.id);
  if (active) throw new Error(`payment ${i.payment.id} already has an active refund request (${active.id})`);
  const all = await requestsCol(db).where("paymentId", "==", i.payment.id).get();
  const now = new Date().toISOString();
  const requestId = `rr_${i.payment.id}_${all.size + 1}`;
  const request: RefundRequest = {
    id: requestId,
    tenantId: i.payment.tenantId,
    studioId: i.payment.studioId,
    paymentId: i.payment.id,
    jobId: i.payment.jobId,
    bookingId: i.payment.bookingId,
    amountPaise: amount,
    reason: i.reason,
    status: "reserved",
    providerRefundId: null,
    projectionNeeded: false,
    lastError: null,
    createdBy: i.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await requestsCol(db).doc(requestId).set(request);
  return { requestId };
}

/**
 * Projects one provider-accepted refund onto the payment, job and booking in
 * a single transaction. Idempotent via projectionNeeded. NEVER touches the
 * issued invoice: credit-note/tax treatment is an owner/accountant hold, so
 * the payment carries invoiceReviewNeeded instead of a fabricated void.
 */
async function projectRefund(db: Firestore, request: RefundRequest & { ref: FirebaseFirestore.DocumentReference }): Promise<void> {
  const now = new Date().toISOString();
  await db.runTransaction(async (tx) => {
    const reqSnap = await tx.get(request.ref);
    const fresh = reqSnap.data() as RefundRequest | undefined;
    if (!fresh || !fresh.projectionNeeded || fresh.status === "projected") return;
    const paymentRef = db.collection(COLLECTIONS.payments()).doc(fresh.paymentId);
    const paySnap = await tx.get(paymentRef);
    if (!paySnap.exists) throw new Error(`payment ${fresh.paymentId} missing during refund projection`);
    const payment = paySnap.data() as Payment;
    const newRefunded = (payment.refundAmount ?? 0) + fresh.amountPaise;
    const check = verifyRefundAccounting({ capturedPaise: payment.amount, refundedPaise: newRefunded });
    if (!check.ok) throw new Error(`refund projection rejected: ${check.reason}`);
    tx.update(paymentRef, {
      status: check.label,
      refundAmount: newRefunded,
      razorpayRefundId: fresh.providerRefundId ?? payment.razorpayRefundId,
      refundedAt: now,
      invoiceReviewNeeded: payment.invoiceId ? true : undefined,
      updatedAt: now,
    });
    if (fresh.jobId) {
      tx.update(db.collection(COLLECTIONS.jobs()).doc(fresh.jobId), {
        paymentStatus: check.label === "refunded" ? "refunded" : "partial",
        updatedAt: now,
      });
    }
    if (fresh.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(fresh.bookingId), {
        paymentStatus: check.label === "refunded" ? "refunded" : "partial",
        updatedAt: now,
      });
    }
    tx.update(request.ref, { status: "projected", projectionNeeded: false, updatedAt: now });
  });
}

/**
 * One runner pass over open requests. Reserved requests are submitted to the
 * provider; anything with projectionNeeded (fresh or left over from a crash)
 * is then projected WITHOUT a second provider call. Single-runner assumption:
 * invoked from one local/emulator gate at a time — there is no scheduler.
 */
export async function runRefundOutbox(
  db: Firestore,
  provider: PaymentProvider,
  opts: { limit?: number } = {},
): Promise<{ submitted: number; projected: number; failed: number }> {
  const limit = opts.limit ?? 10;
  const open: Array<RefundRequest & { ref: FirebaseFirestore.DocumentReference }> = [];
  for (const status of ["reserved", "submitted", "accepted"] as const) {
    const snap = await requestsCol(db).where("status", "==", status).get();
    for (const doc of snap.docs) open.push({ ...(doc.data() as RefundRequest), ref: doc.ref });
    if (open.length >= limit) break;
  }
  let submitted = 0, projected = 0, failed = 0;
  for (const request of open.slice(0, limit)) {
    const now = new Date().toISOString();
    if (request.status === "reserved") {
      const paySnap = await db.collection(COLLECTIONS.payments()).doc(request.paymentId).get();
      const payment = paySnap.data() as Payment | undefined;
      try {
        if (!payment || !payment.razorpayPaymentId) throw new Error("payment has no provider payment id to refund");
        const result = await provider.initiateRefund({
          providerPaymentId: payment.razorpayPaymentId,
          amount: request.amountPaise,
          reason: request.reason,
          referenceId: request.id,
        });
        await request.ref.update({ status: "submitted", providerRefundId: result.providerRefundId, projectionNeeded: true, lastError: null, updatedAt: now });
        submitted++;
        request.status = "submitted";
        request.providerRefundId = result.providerRefundId;
        request.projectionNeeded = true;
      } catch (err) {
        await request.ref.update({ status: "failed", lastError: err instanceof Error ? err.message : String(err), updatedAt: now });
        failed++;
        continue;
      }
    }
    if (request.projectionNeeded) {
      await projectRefund(db, request);
      projected++;
    }
  }
  return { submitted, projected, failed };
}
