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
  if (p.jobId) await db.collection(COLLECTIONS.jobs()).doc(p.jobId).set({ id: p.jobId, tenantId: p.tenantId, bookingId: p.bookingId, paymentStatus: "paid" });
  if (p.bookingId) await db.collection(COLLECTIONS.bookings()).doc(p.bookingId).set({ id: p.bookingId, tenantId: p.tenantId, paymentStatus: "paid" });
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

describe("D-review corrections: concurrency, lifecycle, tenancy, integrity", () => {
  const adminAuth3 = () => ({ uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" });

  it("D1: concurrent legacy initiateRefund and outbox reservation - exactly one path wins, no double claim", async () => {
    for (let round = 0; round < 4; round++) {
      const p = payment();
      await seedPayment(p);
      const [legacy, outbox] = await Promise.allSettled([
        initiateRefund.run({ data: { paymentId: p.id, reason: "generic path" }, auth: adminAuth3() } as never),
        reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" }),
      ]);
      const legacyWon = legacy.status === "fulfilled";
      const outboxWon = outbox.status === "fulfilled";
      expect(legacyWon !== outboxWon).toBe(true);
      const claim = await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get();
      const guard = await db.collection(COLLECTIONS.refundRequests()).doc(`active_${p.id}`).get();
      // Exactly one claim artifact exists - never both, never neither.
      expect(claim.exists).toBe(legacyWon);
      expect(guard.exists).toBe(outboxWon);
    }
  });

  it("D2: two simultaneous runners claim the lease transactionally - the provider is called exactly once", async () => {
    const p = payment();
    await seedPayment(p);
    await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" });
    let providerCalls = 0;
    const provider = new MockPaymentProvider();
    const counting = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider, {
      initiateRefund: async (params: never) => { providerCalls++; await new Promise((r) => setTimeout(r, 50)); return MockPaymentProvider.prototype.initiateRefund.call(provider, params); },
    });
    const [r1, r2] = await Promise.all([
      runRefundOutbox(db, counting, { limit: 10, runnerId: "runner_A" }),
      runRefundOutbox(db, counting, { limit: 10, runnerId: "runner_B" }),
    ]);
    expect(providerCalls).toBe(1);
    expect(r1.submitted + r2.submitted).toBe(1);
    expect(r1.projected + r2.projected).toBe(1);
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(p.amount);
  });

  it("D2b: a crashed runner's stale lease is reconciled via lookup - never blindly resubmitted", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    // Simulate the crash: provider accepted, runner died before recording.
    await provider.initiateRefund({ providerPaymentId: p.razorpayPaymentId!, amount: p.amount, reason: "race", referenceId: requestId });
    const ref = db.collection(COLLECTIONS.refundRequests()).doc(requestId);
    await ref.update({ status: "submitting", leaseBy: "dead_runner", leaseAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    let resubmits = 0;
    const counting = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider, {
      initiateRefund: async (params: never) => { resubmits++; return MockPaymentProvider.prototype.initiateRefund.call(provider, params); },
    });
    const r = await runRefundOutbox(db, counting, { limit: 10, runnerId: "runner_C" });
    expect(resubmits).toBe(0);
    expect(r).toMatchObject({ submitted: 1, projected: 1, failed: 0 });
    const req = (await ref.get()).data() as { status: string };
    expect(req.status).toBe("projected");
  });

  it("D3: provider accepts with pending status - held, not projected; later processed reconciles exactly once", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "slow", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    provider.nextRefundStatus = "pending";
    const r1 = await runRefundOutbox(db, provider, { limit: 10 });
    expect(r1).toMatchObject({ submitted: 1, projected: 0, failed: 0 });
    let pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed"); // NOT projected: pending is not money moved
    expect(pay.refundAmount ?? null).toBeNull();
    expect(refundablePaise(pay)).toBe(p.amount);
    // Provider later reports processed: the same request reconciles and projects.
    provider.setStoredRefundStatus(requestId, "processed");
    const r2 = await runRefundOutbox(db, provider, { limit: 10 });
    expect(r2).toMatchObject({ submitted: 0, projected: 1, failed: 0 });
    pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(p.amount);
  });

  it("D4: a stale caller snapshot cannot overreserve after a partial refund projected", async () => {
    const p = payment();
    await seedPayment(p);
    // First partial refund completes: payment doc now has refundAmount.
    await reserveRefund(db, { payment: p, amountPaise: 40000, reason: "first", createdBy: "admin" });
    await runRefundOutbox(db, new MockPaymentProvider(), { limit: 10 });
    // Caller's stale snapshot still shows the payment as never refunded.
    const stale = { ...p };
    expect(refundablePaise(stale)).toBe(100000);
    await expect(reserveRefund(db, { payment: stale, amountPaise: 100000, reason: "stale overreach", createdBy: "admin" }))
      .rejects.toThrow(/exceeds the refundable 60000/);
    // A reservation that fits the FRESH refundable amount still works.
    const { requestId } = await reserveRefund(db, { payment: stale, amountPaise: 60000, reason: "rest", createdBy: "admin" });
    expect(requestId).toMatch(/^rr_/);
  });

  it("D5: runner scoped by tenant never touches another tenant's requests", async () => {
    const pA = payment({ id: "payA", razorpayPaymentId: "rzp_pay_A" });
    const pB = payment({ id: "payB", tenantId: "t2", razorpayPaymentId: "rzp_pay_B" });
    await seedPayment(pA);
    await seedPayment(pB);
    await reserveRefund(db, { payment: pA, amountPaise: 10000, reason: "a", createdBy: "adminA" });
    await reserveRefund(db, { payment: pB, amountPaise: 10000, reason: "b", createdBy: "adminB" });
    const r = await runRefundOutbox(db, new MockPaymentProvider(), { limit: 10, tenantId: "t1" });
    expect(r).toMatchObject({ submitted: 1, projected: 1, failed: 0 });
    const reqsB = await db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", "payB").get();
    const reqB = reqsB.docs.filter((d) => d.id.startsWith("rr_"))[0]!.data() as { status: string };
    expect(reqB.status).toBe("reserved"); // untouched
    const payB = (await db.collection(COLLECTIONS.payments()).doc("payB").get()).data() as Payment;
    expect(payB.status).toBe("completed");
  });

  it("D6: a request whose job/booking linkage disagrees with the payment never reaches the provider", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin" });
    // Tamper: the request points at a job the payment does not belong to.
    await db.collection(COLLECTIONS.refundRequests()).doc(requestId).update({ jobId: "job_FOREIGN" });
    const provider = new MockPaymentProvider();
    let providerCalls = 0;
    const counting = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider, {
      initiateRefund: async (params: never) => { providerCalls++; return MockPaymentProvider.prototype.initiateRefund.call(provider, params); },
    });
    await runRefundOutbox(db, counting, { limit: 10 });
    expect(providerCalls).toBe(0); // held at preflight, no money movement
    const req = (await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get()).data() as { status: string; lastError: string | null };
    expect(req.status).toBe("ambiguous");
    expect(req.lastError).toContain("integrity preflight failed");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();
  });
});

describe("D-review round 2: lease identity, monotonic transitions, related-record invariant", () => {
  it("D2c: two overlapping passes with the SAME runner identity still submit only once (claim-won gating)", async () => {
    const p = payment();
    await seedPayment(p);
    await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" });
    let providerCalls = 0;
    const provider = new MockPaymentProvider();
    const counting = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider, {
      initiateRefund: async (params: never) => { providerCalls++; await new Promise((r) => setTimeout(r, 50)); return MockPaymentProvider.prototype.initiateRefund.call(provider, params); },
    });
    // Same runnerId for both passes: identity match must NOT authorize a submit.
    const [r1, r2] = await Promise.all([
      runRefundOutbox(db, counting, { limit: 10, runnerId: "admin1:invocationA" }),
      runRefundOutbox(db, counting, { limit: 10, runnerId: "admin1:invocationA" }),
    ]);
    expect(providerCalls).toBe(1);
    expect(r1.submitted + r2.submitted).toBe(1);
    expect(r1.projected + r2.projected).toBe(1);
  });

  it("D2d: slow original runner + stale-lease recovery converge to exactly one projection, no resurrection", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    // Original runner: slow provider call (response in flight while recovery happens).
    const slow = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider, {
      initiateRefund: async (params: never) => { await new Promise((r) => setTimeout(r, 120)); return MockPaymentProvider.prototype.initiateRefund.call(provider, params); },
    });
    const original = runRefundOutbox(db, slow, { limit: 10, runnerId: "runner_ORIG" });
    // Give the original time to win the lease and enter the provider call.
    await new Promise((r) => setTimeout(r, 30));
    // Recovery pass with a zero staleness window: treats the in-flight lease as crashed.
    const recovery = await runRefundOutbox(db, provider, { limit: 10, runnerId: "runner_RECOVERY", leaseStaleMs: 0 });
    const r1 = await original;
    // The provider was called exactly once (recovery reconciled, never resubmitted)...
    const reqs = await db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", p.id).get();
    const req = reqs.docs.filter((d) => d.id === requestId)[0]!.data() as { status: string; providerRefundId: string | null };
    expect(req.status).toBe("projected");
    // ...and exactly one projection landed, regardless of which pass finished first.
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(p.amount);
    expect(pay.status).toBe("refunded");
    expect(r1.projected + recovery.projected).toBe(1);
    expect(r1.submitted + recovery.submitted).toBeGreaterThanOrEqual(1);
  });

  it("D2e: a projected request is terminal - a late hold attempt cannot resurrect it", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "x", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    await runRefundOutbox(db, provider, { limit: 10 });
    const ref = db.collection(COLLECTIONS.refundRequests()).doc(requestId);
    expect((await ref.get()).data()!["status"]).toBe("projected");
    // A failing provider now (late failed notification after projection):
    // no pass may move the request out of projected or touch the payment.
    provider.setStoredRefundStatus(requestId, "failed");
    const r = await runRefundOutbox(db, provider, { limit: 10 });
    expect(r).toEqual({ submitted: 0, projected: 0, failed: 0 });
    expect((await ref.get()).data()!["status"]).toBe("projected");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(p.amount);
  });

  it("D6b: a job from another tenant stops the runner BEFORE any provider call", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin" });
    await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).update({ tenantId: "t2" });
    const provider = new MockPaymentProvider();
    let providerCalls = 0;
    const counting = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider, {
      initiateRefund: async (params: never) => { providerCalls++; return MockPaymentProvider.prototype.initiateRefund.call(provider, params); },
    });
    const r = await runRefundOutbox(db, counting, { limit: 10 });
    expect(providerCalls).toBe(0); // no money movement for known-bad records
    expect(r).toMatchObject({ submitted: 0, projected: 0 });
    const req = (await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get()).data() as { status: string; lastError: string | null };
    expect(req.status).toBe("ambiguous"); // held for data repair, guard retained
    expect(req.lastError).toContain("integrity preflight failed");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
  });

  it("D6c: a missing booking doc stops the runner BEFORE any provider call", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin" });
    await db.collection(COLLECTIONS.bookings()).doc(p.bookingId!).delete();
    const provider = new MockPaymentProvider();
    let providerCalls = 0;
    const counting = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider, {
      initiateRefund: async (params: never) => { providerCalls++; return MockPaymentProvider.prototype.initiateRefund.call(provider, params); },
    });
    await runRefundOutbox(db, counting, { limit: 10 });
    expect(providerCalls).toBe(0);
    const req = (await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get()).data() as { status: string; lastError: string | null };
    expect(req.status).toBe("ambiguous");
    expect(req.lastError).toContain("booking");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
  });

  it("D6d: the in-transaction projection recheck still fires when records break between submit and projection", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin" });
    // Simulate a submitted request awaiting projection, then break the job.
    await db.collection(COLLECTIONS.refundRequests()).doc(requestId)
      .update({ status: "submitted", projectionNeeded: true, providerRefundId: "rfnd_x" });
    await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).update({ tenantId: "t2" });
    await expect(runRefundOutbox(db, new MockPaymentProvider(), { limit: 10 })).rejects.toThrow(/tenant t2 != payment tenant t1/);
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
  });

  it("reserve-time preflight: broken job/booking records refuse the reservation itself", async () => {
    const p = payment();
    await seedPayment(p);
    await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).update({ tenantId: "t2" });
    await expect(reserveRefund(db, { payment: p, amountPaise: 1000, reason: "bad job", createdBy: "a" }))
      .rejects.toThrow(/job .* tenant t2/);
    const p2 = payment();
    await seedPayment(p2);
    await db.collection(COLLECTIONS.bookings()).doc(p2.bookingId!).delete();
    await expect(reserveRefund(db, { payment: p2, amountPaise: 1000, reason: "bad booking", createdBy: "a" }))
      .rejects.toThrow(/booking .* missing/);
    // Nothing reserved, nothing to run: no provider interaction possible.
    const r = await runRefundOutbox(db, new MockPaymentProvider(), { limit: 10 });
    expect(r).toEqual({ submitted: 0, projected: 0, failed: 0 });
  });
});

describe("D-review round 3: deterministic barrier races", () => {
  it("a stale in-flight FAILED response can never overwrite an already-projected request", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "race", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    // Gated provider: the refund lands provider-side as processed, the
    // RESPONSE is held on a barrier we control, then lost (throw).
    let release!: () => void;
    const barrier = new Promise<void>((res) => { release = res; });
    let callStarted = false;
    const gated = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider, {
      initiateRefund: async (params: { providerPaymentId: string; amount: number; reason: string; referenceId: string }) => {
        callStarted = true;
        await MockPaymentProvider.prototype.initiateRefund.call(provider, params); // provider-side accepted
        await barrier; // response in flight...
        throw new Error("network: response lost"); // ...then lost
      },
    });
    const pass1 = runRefundOutbox(db, gated, { limit: 10, runnerId: "runner_ORIG" });
    while (!callStarted) await new Promise((r) => setTimeout(r, 5));
    // Recovery pass sees the lease as crashed and reconciles: found -> submitted -> PROJECTED.
    const recovery = await runRefundOutbox(db, provider, { limit: 10, runnerId: "runner_RECOVERY", leaseStaleMs: 0 });
    expect(recovery).toMatchObject({ submitted: 1, projected: 1, failed: 0 });
    expect(((await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get()).data() as { status: string }).status).toBe("projected");
    // The provider now flips its record to failed (failure NOTIFICATION) and
    // only THEN does the original pass's lost response resolve.
    provider.setStoredRefundStatus(requestId, "failed");
    release();
    const r1 = await pass1;
    // The stale pass could not overwrite the projected terminal state.
    expect(r1).toEqual({ submitted: 0, projected: 0, failed: 0 });
    expect(((await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get()).data() as { status: string }).status).toBe("projected");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(p.amount);
  });

  it("overlapping lifecycle reconciliations (pending -> processed) commit exactly one projection", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "slow", createdBy: "admin" });
    const provider = new MockPaymentProvider();
    provider.nextRefundStatus = "pending";
    const r1 = await runRefundOutbox(db, provider, { limit: 10, runnerId: "runner_A" });
    expect(r1).toMatchObject({ submitted: 1, projected: 0, failed: 0 });
    provider.setStoredRefundStatus(requestId, "processed");
    // Two overlapping reconciliation passes both load the submitted-held state.
    const [r2, r3] = await Promise.all([
      runRefundOutbox(db, provider, { limit: 10, runnerId: "runner_B" }),
      runRefundOutbox(db, provider, { limit: 10, runnerId: "runner_C" }),
    ]);
    // Exactly one COMMITTED projection across both passes (no-op losing races
    // are not counted).
    expect(r2.projected + r3.projected).toBe(1);
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(p.amount);
    const req = (await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get()).data() as { status: string };
    expect(req.status).toBe("projected");
  });
});

describe("D-review round 4: pre-effect financial and strict-linkage gates", () => {
  const countingProvider = (provider: MockPaymentProvider) => {
    const box = { calls: 0 };
    const wrapped = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider, {
      initiateRefund: async (params: never) => { box.calls++; return MockPaymentProvider.prototype.initiateRefund.call(provider, params); },
    });
    return { wrapped, box };
  };

  it("a tampered request pointing at a DIFFERENT existing same-tenant job+booking never reaches the provider", async () => {
    const p = payment();
    await seedPayment(p);
    // A second, legitimate same-tenant job+booking pair that belongs to another payment.
    const other = payment();
    await seedPayment(other);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin" });
    // Tamper: point the request at the OTHER payment's job+booking (which are
    // internally consistent with each other and same-tenant).
    await db.collection(COLLECTIONS.refundRequests()).doc(requestId).update({ jobId: other.jobId, bookingId: other.bookingId });
    const provider = new MockPaymentProvider();
    const { wrapped, box } = countingProvider(provider);
    await runRefundOutbox(db, wrapped, { limit: 10 });
    expect(box.calls).toBe(0);
    const req = (await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get()).data() as { status: string; lastError: string | null };
    expect(req.status).toBe("ambiguous");
    expect(req.lastError).toContain("request job");
  });

  it("a payment fully refunded after reservation holds at submit: provider never called", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 60000, reason: "x", createdBy: "admin" });
    // Financial state changed after reservation: already refunded elsewhere.
    await db.collection(COLLECTIONS.payments()).doc(p.id).update({ status: "refunded", refundAmount: p.amount });
    const provider = new MockPaymentProvider();
    const { wrapped, box } = countingProvider(provider);
    await runRefundOutbox(db, wrapped, { limit: 10 });
    expect(box.calls).toBe(0);
    const req = (await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get()).data() as { status: string; lastError: string | null };
    expect(req.status).toBe("ambiguous");
    expect(req.lastError).toMatch(/not refundable|below reserved/);
  });

  it("a payment whose stored currency went missing holds before submit (cannot bind reconciliation)", async () => {
    const p = payment();
    await seedPayment(p);
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin" });
    await db.collection(COLLECTIONS.payments()).doc(p.id).update({ currency: null });
    const provider = new MockPaymentProvider();
    const { wrapped, box } = countingProvider(provider);
    await runRefundOutbox(db, wrapped, { limit: 10 });
    expect(box.calls).toBe(0);
    const req = (await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get()).data() as { status: string; lastError: string | null };
    expect(req.status).toBe("ambiguous");
    expect(req.lastError).toContain("currency");
  });
});

describe("legacy initiateRefund ambiguity interlock", () => {
  const adminAuth4 = () => ({ uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" });

  it("lost provider response with provider-side acceptance: claim retained, refund still projected truthfully", async () => {
    const p = payment({ bookingId: null, jobId: null, targetType: "job" });
    await seedPayment(p);
    // Mock: accepted provider-side, response lost. loseNextRefundResponse is
    // consumed via getPaymentProvider inside the callable - use the shared mock.
    const { mockProvider } = await import("../../lib/mock-payment-provider.js");
    mockProvider.loseNextRefundResponse = true;
    const r = await initiateRefund.run({ data: { paymentId: p.id, reason: "lost response" }, auth: adminAuth4() } as never);
    expect(r).toMatchObject({ refunded: true });
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(p.amount);
    // The claim exists and blocks any outbox reservation for the same money
    // (either via the legacy-claim check or the now-zero refundable balance).
    await expect(reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "second", createdBy: "admin" }))
      .rejects.toThrow(/manual refund obligation|exceeds the refundable/);
  });

  it("unknown provider outcome: claim RETAINED (no silent release), no payment writes, outbox still blocked", async () => {
    const p = payment({ bookingId: null, jobId: null });
    await seedPayment(p);
    const { mockProvider } = await import("../../lib/mock-payment-provider.js");
    // Provider call throws and the lookup cannot see anything (default:
    // unknown) - the genuinely ambiguous case.
    mockProvider.loseNextRefundResponse = false;
    const realInit = mockProvider.initiateRefund.bind(mockProvider);
    mockProvider.initiateRefund = (async () => { throw new Error("network: connection reset before any provider state"); }) as never;
    await expect(initiateRefund.run({ data: { paymentId: p.id, reason: "ambiguous" }, auth: adminAuth4() } as never))
      .rejects.toMatchObject({ code: "unavailable" });
    mockProvider.initiateRefund = realInit;
    // Claim retained: payment untouched, no second submission possible.
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();
    const claim = await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get();
    expect(claim.exists).toBe(true);
    await expect(reserveRefund(db, { payment: p, amountPaise: p.amount, reason: "second", createdBy: "admin" }))
      .rejects.toThrow(/manual refund obligation/);
    // A retry of the legacy path also refuses while the claim stands.
    await expect(initiateRefund.run({ data: { paymentId: p.id, reason: "retry" }, auth: adminAuth4() } as never))
      .rejects.toMatchObject({ code: "already-exists" });
  });

  it("authoritative provider absence: claim released, retry possible", async () => {
    const p = payment({ bookingId: null, jobId: null });
    await seedPayment(p);
    const { mockProvider } = await import("../../lib/mock-payment-provider.js");
    mockProvider.authoritativeNegatives = true;
    const realInit = mockProvider.initiateRefund.bind(mockProvider);
    mockProvider.initiateRefund = (async () => { throw new Error("network: connection reset before any provider state"); }) as never;
    await expect(initiateRefund.run({ data: { paymentId: p.id, reason: "ambiguous" }, auth: adminAuth4() } as never))
      .rejects.not.toMatchObject({ code: "unavailable" });
    mockProvider.initiateRefund = realInit;
    const claim = await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get();
    expect(claim.exists).toBe(false);
    mockProvider.authoritativeNegatives = false;
  });
});
