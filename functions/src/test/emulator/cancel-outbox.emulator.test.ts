/**
 * adminCancelBooking rerouted through the refund outbox (single refund
 * authority): the cancellation reserves the refund; the callable makes NO
 * provider call and writes NO refund projection; the runner submits and
 * projects truthfully. Manual (non-Razorpay) refunds keep the deployed
 * record-what-the-studio-returns behavior.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { runCancel } from "../../functions/booking/adminCancelBooking.js";
import { runRefundOutbox } from "../../lib/refund-outbox.js";
import { MockPaymentProvider } from "../../lib/mock-payment-provider.js";
import { initiateRefund } from "../../functions/payment/initiateRefund.js";

const db = getFirestore();
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;
const adminUser = () => ({ uid: uid("admin"), claims: { role: "admin", tenantId: "t1", studioId: null } }) as never;
const adminAuth = () => ({ uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" });

async function seed(o: { method: string; amount?: number; scheduledInHrs?: number }) {
  const bookingId = uid("b");
  const jobId = uid("job");
  const payId = uid("pay");
  const invId = uid("inv");
  const scheduledAt = new Date(Date.now() + (o.scheduledInHrs ?? 2) * 3600_000).toISOString();
  await db.collection(COLLECTIONS.bookings()).doc(bookingId).set({
    id: bookingId, tenantId: "t1", studioId: "s1", customerId: "c1", serviceId: "svc1",
    status: "CONFIRMED", scheduledAt, totalAmount: o.amount ?? 100000,
    cancelCategories: [], paymentStatus: "paid",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.jobs()).doc(jobId).set({
    id: jobId, tenantId: "t1", studioId: "s1", bookingId, status: "PENDING_VEHICLE",
    paymentStatus: "paid", statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.payments()).doc(payId).set({
    id: payId, tenantId: "t1", studioId: "s1", targetType: "job", jobId, bookingId,
    membershipId: null, giftId: null, customerId: "c1", amount: o.amount ?? 100000, currency: "INR",
    method: o.method, status: "completed", razorpayPaymentLinkId: "pl1",
    razorpayPaymentId: o.method === "razorpay_payment_link" ? "rzp_pay_1" : null,
    razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: invId, providerEventId: null,
    completedAt: new Date().toISOString(), failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as Payment);
  await db.collection(COLLECTIONS.invoices()).doc(invId).set({
    id: invId, tenantId: "t1", studioId: "s1", status: "issued", total: o.amount ?? 100000,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  return { bookingId, jobId, payId, invId };
}

beforeEach(async () => {
  for (const col of [COLLECTIONS.bookings(), COLLECTIONS.jobs(), COLLECTIONS.payments(), COLLECTIONS.invoices(), COLLECTIONS.refundRequests(), COLLECTIONS.paymentEvents()]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe("adminCancelBooking -> outbox (single refund authority)", () => {
  it("razorpay cancel with late fee: reserves partial refund, NO provider call, NO projection; runner then submits and projects truthfully; legacy path refuses", async () => {
    const { bookingId, jobId, payId, invId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    const provider = new MockPaymentProvider();
    let providerCalls = 0;
    const realInit = provider.initiateRefund.bind(provider);
    provider.initiateRefund = (async (...a: unknown[]) => { providerCalls++; return realInit(...(a as [])); }) as never;

    const r = await runCancel(adminUser(), { bookingId, reason: "changed plans", feeAction: "charge" }, "admin");
    expect(r).toMatchObject({ success: true, feePaise: 10000, refundPaise: 90000, manualRefund: false });
    expect((r as { refundRequestId?: string }).refundRequestId).toBeTruthy();
    expect(providerCalls).toBe(0); // the callable NEVER calls the provider

    // No projection by the callable: payment + invoice untouched.
    let pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();
    expect(((await db.collection(COLLECTIONS.invoices()).doc(invId).get()).data() as { status: string }).status).toBe("issued");
    // Booking cancelled with a REQUESTED (not fabricated) refund state.
    const booking = (await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>;
    expect(booking.status).toBe("CANCELLED");
    expect(booking.refundStatus).toBe("requested");
    expect(booking.refundRequestId).toBeTruthy();
    expect(booking.refundedPaise ?? 0).toBe(0);

    // The runner submits the reserved partial and projects truthfully.
    const out = await runRefundOutbox(db, provider, { limit: 10 });
    expect(out).toMatchObject({ submitted: 1, projected: 1, failed: 0 });
    pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect((pay.status as string)).toBe("partially_refunded"); // fee withheld: truthful partial
    expect(pay.refundAmount).toBe(90000);
    expect(providerCalls).toBe(1); // exactly one provider submission end to end
    // The issued invoice is NEVER voided by the projection (credit-note hold).
    expect(((await db.collection(COLLECTIONS.invoices()).doc(invId).get()).data() as { status: string }).status).toBe("issued");
    // Requested -> processed: the booking now carries the REAL amount and id.
    const settled = (await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>;
    expect(settled.refundStatus).toBe("processed");
    expect(settled.refundedPaise).toBe(90000);
    expect(settled.refundId).toBeTruthy();
    expect(settled.refundRequestedPaise).toBe(90000);

    // Interlock: the legacy manual path refuses on the same payment.
    await expect(initiateRefund.run({ data: { paymentId: payId, reason: "second" }, auth: adminAuth() } as never))
      .rejects.toThrow();
    const job = (await db.collection(COLLECTIONS.jobs()).doc(jobId).get()).data() as Record<string, unknown>;
    expect(job.status).toBe("CANCELLED");
    expect(job.paymentStatus).toBe("partial");
  });

  it("waived fee: full refund reserved and projected as fully refunded", async () => {
    const { bookingId, payId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    const provider = new MockPaymentProvider();
    const r = await runCancel(adminUser(), { bookingId, reason: "studio cannot take it", feeAction: "waive" }, "admin");
    expect(r).toMatchObject({ success: true, feePaise: 0, refundPaise: 100000 });
    const out = await runRefundOutbox(db, provider, { limit: 10 });
    expect(out).toMatchObject({ submitted: 1, projected: 1, failed: 0 });
    const pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(100000);
  });

  it("cash payment: manual refund record path preserved (refunded + invoice void, no outbox request)", async () => {
    const { bookingId, payId, invId } = await seed({ method: "cash", amount: 100000, scheduledInHrs: 2 });
    const r = await runCancel(adminUser(), { bookingId, reason: "changed plans", feeAction: "charge" }, "admin");
    expect(r).toMatchObject({ success: true, manualRefund: true, refundPaise: 90000 });
    const pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(90000);
    expect(((await db.collection(COLLECTIONS.invoices()).doc(invId).get()).data() as { status: string }).status).toBe("void");
    const reqs = await db.collection(COLLECTIONS.refundRequests()).get();
    expect(reqs.empty).toBe(true); // no outbox involvement for manual money
  });

  it("a malformed Razorpay payment (no provider payment id) HOLDS - never falls through to a fake manual refund", async () => {
    const bookingId = uid("b"); const jobId = uid("job"); const payId = uid("pay");
    await db.collection(COLLECTIONS.bookings()).doc(bookingId).set({
      id: bookingId, tenantId: "t1", studioId: "s1", customerId: "c1", serviceId: "svc1",
      status: "CONFIRMED", scheduledAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
      totalAmount: 100000, cancelCategories: [], paymentStatus: "paid",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.collection(COLLECTIONS.jobs()).doc(jobId).set({
      id: jobId, tenantId: "t1", studioId: "s1", bookingId, status: "PENDING_VEHICLE",
      paymentStatus: "paid", statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.collection(COLLECTIONS.payments()).doc(payId).set({
      id: payId, tenantId: "t1", studioId: "s1", targetType: "job", jobId, bookingId,
      membershipId: null, giftId: null, customerId: "c1", amount: 100000, currency: "INR",
      method: "razorpay_payment_link", status: "completed", razorpayPaymentLinkId: "pl1",
      razorpayPaymentId: null, razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
      manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
      completedAt: new Date().toISOString(), failedAt: null, cancelledAt: null, refundedAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as Payment);
    await expect(runCancel(adminUser(), { bookingId, reason: "x", feeAction: "waive" }, "admin"))
      .rejects.toThrow(/missing its provider payment id/);
    const booking = (await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>;
    expect(booking.status).toBe("CONFIRMED"); // NOT cancelled
    const pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.status).toBe("completed"); // never marked refunded
    const reqs = await db.collection(COLLECTIONS.refundRequests()).get();
    expect(reqs.empty).toBe(true);
  });

  it("barrier: a job that STARTS between the initial read and the commit refuses the cancel and leaves NO reservation, NO guard, NO provider call", { timeout: 30000 }, async () => {
    const { bookingId, jobId, payId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    const provider = new MockPaymentProvider();
    let providerCalls = 0;
    const realInit = provider.initiateRefund.bind(provider);
    provider.initiateRefund = (async (...a: unknown[]) => { providerCalls++; return realInit(...(a as [])); }) as never;
    // Interleave: work starts on the job AFTER runCancel's initial reads but
    // BEFORE its cancellation transaction begins - the transaction's fresh
    // revalidation must refuse, and nothing may survive. (Writing the job
    // from outside an OPEN transaction would deadlock against its locks in
    // the emulator, so the barrier fires before the transaction starts.)
    const origRun = db.runTransaction.bind(db);
    let interleaved = false;
    (db as unknown as { runTransaction: unknown }).runTransaction = async (cb: (tx: never) => Promise<unknown>) => {
      if (!interleaved) {
        interleaved = true;
        await db.collection(COLLECTIONS.jobs()).doc(jobId).update({ status: "IN_PROGRESS", updatedAt: new Date().toISOString() });
      }
      return origRun(cb);
    };
    await expect(runCancel(adminUser(), { bookingId, reason: "race", feeAction: "waive" }, "admin"))
      .rejects.toThrow(/already started/);
    (db as unknown as { runTransaction: unknown }).runTransaction = origRun;
    expect(interleaved).toBe(true); // the barrier actually fired mid-transaction
    const booking = (await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>;
    expect(booking.status).toBe("CONFIRMED");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    const reqs = await db.collection(COLLECTIONS.refundRequests()).get();
    expect(reqs.empty).toBe(true); // no standalone runnable reservation
    const out = await runRefundOutbox(db, provider, { limit: 10 });
    expect(out).toMatchObject({ submitted: 0, projected: 0, failed: 0 });
    expect(providerCalls).toBe(0);
  });

  it("double-tap: two concurrent cancels commit exactly ONE reservation and ONE cancellation", { timeout: 45000 }, async () => {
    const { bookingId, payId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    const provider = new MockPaymentProvider();
    const [r1, r2] = await Promise.allSettled([
      runCancel(adminUser(), { bookingId, reason: "tap1", feeAction: "waive" }, "admin"),
      runCancel(adminUser(), { bookingId, reason: "tap2", feeAction: "waive" }, "admin"),
    ]);
    const ok = [r1, r2].filter((r) => r.status === "fulfilled");
    expect(ok.length).toBe(1);
    const reqs = await db.collection(COLLECTIONS.refundRequests()).get();
    expect(reqs.docs.filter((d) => d.id.startsWith("rr_")).length).toBe(1);
    const out = await runRefundOutbox(db, provider, { limit: 10 });
    expect(out).toMatchObject({ submitted: 1, projected: 1, failed: 0 });
    const pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.refundAmount).toBe(100000); // exactly once
  });

  it("a reserve failure cancels NOTHING (booking stays live, no partial state)", { timeout: 30000 }, async () => {
    const { bookingId, payId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    // Pre-claim via the legacy path's claim doc shape so the reservation refuses.
    await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${payId}`).set({ paymentId: payId, claimedAt: new Date().toISOString() });
    await expect(runCancel(adminUser(), { bookingId, reason: "x", feeAction: "waive" }, "admin"))
      .rejects.toThrow(/NOT cancelled/i);
    const booking = (await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>;
    expect(booking.status).toBe("CONFIRMED"); // untouched
    const pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.status).toBe("completed");
  });
});
