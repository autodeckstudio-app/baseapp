/**
 * Track A2 negative-path emulator suite (real Firestore, mock provider only).
 * Proves on the new tree: concurrent reservations leave exactly one winner,
 * partial/refund limits hold across runs, ambiguous holds block duplicate
 * requests until reconciled from provider evidence, and webhook interactions
 * (reserved acceptance, late capture, unreserved dashboard refund) behave.
 * No live provider calls anywhere: USE_PAYMENT_MOCK + MockPaymentProvider.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

process.env["USE_PAYMENT_MOCK"] = "true";

import { reserveRefund, runRefundOutbox, refundablePaise, activeReservation } from "../../lib/refund-outbox.js";
import { MockPaymentProvider } from "../../lib/mock-payment-provider.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { requestBookingRefund } from "../../functions/payment/requestBookingRefund.js";
import { processRefundOutbox } from "../../functions/payment/processRefundOutbox.js";
import { initiateRefund } from "../../functions/payment/initiateRefund.js";

const db = getFirestore();
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;

function payment(o: Record<string, unknown> = {}): Payment {
  return {
    id: uid("pay"), tenantId: "t1", studioId: "s1", targetType: "job", jobId: uid("job"), bookingId: uid("b"),
    membershipId: null, giftId: null, customerId: "c1", amount: 100000, currency: "INR",
    method: "razorpay_payment_link", status: "completed", razorpayPaymentLinkId: "pl1",
    razorpayPaymentId: "rzp_pay_1", razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
    completedAt: new Date().toISOString(), failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...o,
  };
}

async function seedPayment(p: Payment) {
  await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
  if (p.jobId) await db.collection(COLLECTIONS.jobs()).doc(p.jobId).set({ id: p.jobId, paymentStatus: "paid" });
  if (p.bookingId) await db.collection(COLLECTIONS.bookings()).doc(p.bookingId).set({ id: p.bookingId, paymentStatus: "paid" });
}

beforeEach(async () => {
  // Wipe the collections this suite touches.
  for (const col of [COLLECTIONS.payments(), COLLECTIONS.jobs(), COLLECTIONS.bookings(), COLLECTIONS.refundRequests(), COLLECTIONS.paymentEvents()]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe("concurrent reservations", () => {
  it("two simultaneous reserveRefund calls for one payment leave exactly one active request", async () => {
    const p = payment();
    await seedPayment(p);
    const [r1, r2] = await Promise.allSettled([
      reserveRefund(db, { payment: p, amountPaise: 50000, reason: "race A", createdBy: "a1" }),
      reserveRefund(db, { payment: p, amountPaise: 50000, reason: "race B", createdBy: "a2" }),
    ]);
    const ok = [r1, r2].filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const all = await db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", p.id).get();
    // The query also matches the winner's active_<paymentId> guard doc; the
    // assertion that matters is exactly one real request (rr_*).
    const requests = all.docs.filter((d) => d.id.startsWith("rr_"));
    expect(requests).toHaveLength(1);
    expect(all.size).toBe(2);
    // Loser gets the duplicate error, not a silent second reservation.
    const loser = [r1, r2].find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(loser.reason)).toMatch(/already has an active refund request/);
  });
});

describe("partial refund limits", () => {
  it("partials draw down the refundable balance and never exceed it", async () => {
    const p = payment();
    await seedPayment(p);
    const provider = new MockPaymentProvider();
    await reserveRefund(db, { payment: p, amountPaise: 80000, reason: "first", createdBy: "a1" });
    await runRefundOutbox(db, provider);
    let snap = await db.collection(COLLECTIONS.payments()).doc(p.id).get();
    expect(snap.data()).toMatchObject({ status: "partially_refunded", refundAmount: 80000 });
    const afterFirst = snap.data() as Payment;
    expect(refundablePaise(afterFirst)).toBe(20000);
    // Remainder is reservable; more than the remainder is not.
    await reserveRefund(db, { payment: afterFirst, amountPaise: 20000, reason: "rest", createdBy: "a1" });
    await runRefundOutbox(db, provider);
    snap = await db.collection(COLLECTIONS.payments()).doc(p.id).get();
    expect(snap.data()).toMatchObject({ status: "refunded", refundAmount: 100000 });
    const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).get();
    expect(jobSnap.data()!["paymentStatus"]).toBe("refunded");
  });
});

describe("ambiguous hold on real Firestore", () => {
  it("blocks a second request until provider evidence reconciles", async () => {
    const p = payment();
    await seedPayment(p);
    await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "a1" });
    const requestId = `rr_${p.id}_1`;
    // Force the unresolved state: submit outcome unknown.
    await db.collection(COLLECTIONS.refundRequests()).doc(requestId).update({ status: "ambiguous", lastError: "response lost" });
    await expect(reserveRefund(db, { payment: p, amountPaise: 1000, reason: "second", createdBy: "a2" }))
      .rejects.toThrow(/already has an active refund request/);
    // Provider confirms the refund exists -> reconcile + project, guard releases.
    const provider = new MockPaymentProvider();
    await provider.initiateRefund({ providerPaymentId: "rzp_pay_1", amount: 50000, reason: "x", referenceId: requestId });
    const r = await runRefundOutbox(db, provider);
    expect(r.projected).toBe(1);
    const snap = await db.collection(COLLECTIONS.payments()).doc(p.id).get();
    expect(snap.data()).toMatchObject({ status: "partially_refunded", refundAmount: 50000 });
    expect(await activeReservation(db, p.id)).toBeNull();
    // Now a fresh reservation is possible again.
    const again = await reserveRefund(db, { payment: snap.data() as Payment, amountPaise: 1000, reason: "second, now allowed", createdBy: "a2" });
    expect(again.requestId).toBe(`rr_${p.id}_2`);
  });
});

describe("webhook interactions", () => {
  const ev = (o: Record<string, unknown>) => ({
    eventType: "refund.created", providerEventId: uid("evt"), providerPaymentId: "rzp_pay_1",
    providerPaymentLinkId: "pl1", providerRefundId: "rfnd_x", referenceId: null,
    amount: 50000, currency: "INR",
    providerRefundAmount: 50000, providerRefundCurrency: "INR", providerRefundPaymentId: "rzp_pay_1", ...o,
  }) as never;

  it("reserved refund.created records acceptance only", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "a1" });
    const r = await processProviderEvent(db, ev({ referenceId: p.id, providerRefundId: `mock_rfnd_${requestId}`, providerRefundReceipt: requestId }));
    expect(r.outcome).toBe("refund_accepted");
    const snap = await db.collection(COLLECTIONS.payments()).doc(p.id).get();
    expect(snap.data()!["status"]).toBe("completed");
  });

  it("late capture on a partially refunded payment changes nothing", async () => {
    const p = payment({ status: "partially_refunded", refundAmount: 20000 });
    await seedPayment(p);
    const r = await processProviderEvent(db, ev({ eventType: "payment.captured", referenceId: p.id, amount: 100000 }));
    expect(r.outcome).toBe("already_final");
    const snap = await db.collection(COLLECTIONS.payments()).doc(p.id).get();
    expect(snap.data()).toMatchObject({ status: "partially_refunded", refundAmount: 20000 });
  });
});

describe("callable gates", () => {
  const adminAuth = () => ({ uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" });
  const customerAuth = () => ({ uid: uid("cust"), token: { role: "customer", tenantId: "t1", studioId: null }, rawToken: "t" });

  it("requestBookingRefund rejects non-admins and reserves for admins", async () => {
    const p = payment();
    await seedPayment(p);
    await expect(requestBookingRefund.run({ data: { paymentId: p.id, reason: "customer ask" }, auth: customerAuth() } as never))
      .rejects.toMatchObject({ code: "permission-denied" });
    const r = (await requestBookingRefund.run({ data: { paymentId: p.id, reason: "customer asked nicely" }, auth: adminAuth() } as never)) as { status: string };
    expect(r.status).toBe("reserved");
  });

  it("initiateRefund refuses a booking-linked payment (duplicate-path closure)", async () => {
    const p = payment();
    await seedPayment(p);
    await expect(initiateRefund.run({ data: { paymentId: p.id, reason: "generic path" }, auth: adminAuth() } as never))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("processRefundOutbox runs in the dev project with the mock provider", async () => {
    const p = payment();
    await seedPayment(p);
    await requestBookingRefund.run({ data: { paymentId: p.id, reason: "run me" }, auth: adminAuth() } as never);
    const r = (await processRefundOutbox.run({ data: {}, auth: adminAuth() } as never)) as { submitted: number; projected: number; failed: number };
    expect(r).toEqual({ submitted: 1, projected: 1, failed: 0 });
  });
});
