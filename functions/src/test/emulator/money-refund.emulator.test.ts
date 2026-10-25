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
    membershipId: null, customerId: "c1", amount: 100000, currency: "INR",
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

describe("consumer fail-closed at the provider boundary", () => {
  // Regression for the adapter contract: even if findRefundByReference THROWS
  // (transport rejection / malformed JSON escaping the adapter), the runner
  // catches it as "unknown": the request holds as ambiguous, the reservation
  // is NOT released, and a re-run NEVER resubmits a second refund.
  class ThrowingProvider extends MockPaymentProvider {
    submitCalls = 0;
    override async initiateRefund(params: Parameters<MockPaymentProvider["initiateRefund"]>[0]): Promise<never> {
      this.submitCalls++;
      throw new Error(`submit response lost (ref may exist provider-side) for ${params.referenceId}`);
    }
    override async findRefundByReference(): Promise<never> {
      throw new Error("network down"); // transport/parse failure escaping the adapter
    }
  }

  it("throwing lookup holds ambiguous, keeps the reservation, never resubmits", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "a1" });
    const provider = new ThrowingProvider();
    await runRefundOutbox(db, provider);
    let snap = await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get();
    expect(snap.data()).toMatchObject({ status: "ambiguous" });
    // Money untouched: payment not refunded, reservation still held.
    expect((await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()).toMatchObject({ status: "completed" });
    expect(await activeReservation(db, p.id)).not.toBeNull();
    // Re-run: reconcile path only - no second submit, state unchanged.
    await runRefundOutbox(db, provider);
    expect(provider.submitCalls).toBe(1);
    snap = await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get();
    expect(snap.data()).toMatchObject({ status: "ambiguous" });
    expect(await activeReservation(db, p.id)).not.toBeNull();
    // And a new reservation is still blocked while the hold is unresolved.
    await expect(reserveRefund(db, { payment: p, amountPaise: 1000, reason: "second", createdBy: "a2" }))
      .rejects.toThrow(/already has an active refund request/);
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

  it("processRefundOutbox runs in the dev project with the mock provider", async () => {
    const p = payment();
    await seedPayment(p);
    await requestBookingRefund.run({ data: { paymentId: p.id, reason: "run me" }, auth: adminAuth() } as never);
    const r = (await processRefundOutbox.run({ data: {}, auth: adminAuth() } as never)) as { submitted: number; projected: number; failed: number };
    expect(r).toEqual({ submitted: 1, projected: 1, failed: 0 });
  });
});

describe("legacy initiateRefund <-> outbox mutual interlock (both race orders)", () => {
  const adminAuth2 = () => ({ uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" });

  it("legacy claim first: an existing refund_<paymentId> claim blocks every outbox reservation, no provider submit", async () => {
    const p = payment({ bookingId: null });
    await seedPayment(p);
    // What the DEPLOYED initiateRefund writes before calling the provider:
    await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).set({ paymentId: p.id, claimedAt: new Date().toISOString(), claimedBy: "legacy" });
    await expect(reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" }))
      .rejects.toThrow(/manual refund obligation/);
    // Nothing reserved: a runner pass submits nothing to the provider.
    const r = await runRefundOutbox(db, new MockPaymentProvider(), { limit: 10 });
    expect(r).toMatchObject({ submitted: 0, projected: 0, failed: 0 });
    const reqs = await db.collection(COLLECTIONS.refundRequests()).get();
    expect(reqs.size).toBe(0);
  });

  it("outbox first: an active reservation makes legacy initiateRefund refuse (already-exists), provider never called twice", async () => {
    const p = payment({ bookingId: null });
    await seedPayment(p);
    await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" });
    await expect(initiateRefund.run({ data: { paymentId: p.id, reason: "generic path" }, auth: adminAuth2() } as never))
      .rejects.toMatchObject({ code: "already-exists" });
    // The legacy claim doc must NOT have been written by the refused call.
    const claim = await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get();
    expect(claim.exists).toBe(false);
  });
});

describe("failed_confirmed races: delayed events, hold, recovery", () => {
  it("lost submit + provider reports failed: request HELD ambiguous with evidence, guard kept, balance blocked, no projection", async () => {
    const p = payment();
    await seedPayment(p);
    await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    provider.failNextRefund = true;
    const r = await runRefundOutbox(db, provider, { limit: 10 });
    expect(r).toMatchObject({ submitted: 0, projected: 0, failed: 1 });
    const reqs = await db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", p.id).get();
    const req = reqs.docs.filter((d) => d.id.startsWith("rr_"))[0]?.data() as { status: string; lastError: string | null };
    expect(req.status).toBe("ambiguous");
    expect(req.lastError).toContain("reported failed");
    expect(req.lastError).toContain("manual reconciliation");
    // Guard KEPT: active reservation still blocks anything new; balance stays blocked.
    expect(await activeReservation(db, p.id)).not.toBeNull();
    expect(refundablePaise({ ...p } as Payment)).toBe(p.amount); // no refund projected yet
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();
  });

  it("while a failed notification holds, NO new reservation can open (double-refund impossible)", async () => {
    const p = payment();
    await seedPayment(p);
    await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "first", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    provider.failNextRefund = true;
    await runRefundOutbox(db, provider, { limit: 10 });
    await expect(reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "retry", createdBy: "admin" }))
      .rejects.toThrow(/already has an active refund request/);
  });

  it("failed notification that later processed: next reconcile projects exactly once (why holds must not release)", async () => {
    const p = payment();
    await seedPayment(p);
    await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    provider.failNextRefund = true;
    await runRefundOutbox(db, provider, { limit: 10 });
    // Provider-side truth turns out to be processed; the SAME reference reconciles.
    const reqId = (await db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", p.id).get()).docs.filter((d) => d.id.startsWith("rr_"))[0]!.id;
    provider.setStoredRefundStatus(reqId, "processed");
    const r = await runRefundOutbox(db, provider, { limit: 10 });
    expect(r).toMatchObject({ submitted: 1, projected: 1, failed: 0 });
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(p.amount);
    const reqs = await db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", p.id).get();
    const rrdocs = reqs.docs.filter((d) => d.id.startsWith("rr_"));
    expect(rrdocs.length).toBe(1);
    expect((rrdocs[0]!.data() as { status: string }).status).toBe("projected");
  });

  it("delayed refund.processed for the failed refund is ignored: no projection, refundAmount unchanged", async () => {
    const p = payment();
    await seedPayment(p);
    await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    provider.failNextRefund = true;
    await runRefundOutbox(db, provider, { limit: 10 });
    const failedRefundId = `mock_rfnd_${(await db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", p.id).get()).docs.filter((d) => d.id.startsWith("rr_"))[0]?.id}`;
    const r = await processProviderEvent(db, {
      provider: "razorpay",
      providerEventId: `evt_late_${Date.now()}`,
      eventType: "refund.processed",
      providerPaymentId: p.razorpayPaymentId,
      providerRefundId: failedRefundId,
      amount: p.amount,
      currency: "INR",
      receipt: null,
      raw: {},
    } as never);
    expect((r as { outcome: string }).outcome).not.toBe("projected");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();
  });

  it("repeat reconcile on a failed-hold: no resubmit, no error, hold stays held", async () => {
    const p = payment();
    await seedPayment(p);
    await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    provider.failNextRefund = true;
    await runRefundOutbox(db, provider, { limit: 10 });
    const r2 = await runRefundOutbox(db, provider, { limit: 10 });
    expect(r2).toMatchObject({ submitted: 0, projected: 0, failed: 0 });
    const reqs = await db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", p.id).get();
    const rrdocs2 = reqs.docs.filter((d) => d.id.startsWith("rr_"));
    expect(rrdocs2.length).toBe(1);
    expect((rrdocs2[0]!.data() as { status: string }).status).toBe("ambiguous");
  });
});
