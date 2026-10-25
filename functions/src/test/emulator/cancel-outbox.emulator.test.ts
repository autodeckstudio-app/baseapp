/**
 * adminCancelBooking rerouted through the refund outbox (single refund
 * authority), RESERVE-ONLY CONTAINMENT variant: the cancellation reserves the
 * refund INSIDE the cancellation transaction and the callable does NOT drain
 * post-commit (a reservation emits no provider event, so no webhook can
 * bootstrap it either). The ONLY submission path is the manual runner, which
 * these tests drive explicitly. Manual (non-Razorpay) refunds keep the
 * deployed record-what-the-studio-returns behavior.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { runCancel } from "../../functions/booking/adminCancelBooking.js";
import { runRefundOutbox } from "../../lib/refund-outbox.js";
import { MockPaymentProvider, mockProvider } from "../../lib/mock-payment-provider.js";
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
    // Production-shaped issued invoice: full linkage on every axis.
    id: invId, tenantId: "t1", studioId: "s1", jobId, bookingId, customerId: "c1",
    vehicleId: "v1", paymentId: payId, invoiceNumber: "INV-TEST-1",
    status: "issued", total: o.amount ?? 100000,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  return { bookingId, jobId, payId, invId };
}

beforeEach(async () => {
  for (const col of [COLLECTIONS.bookings(), COLLECTIONS.jobs(), COLLECTIONS.payments(), COLLECTIONS.invoices(), COLLECTIONS.refundRequests(), COLLECTIONS.paymentRefunds(), COLLECTIONS.paymentEvents()]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  mockProvider.reset();
});

describe("adminCancelBooking -> outbox (single refund authority)", () => {
  it("razorpay cancel with late fee: atomic reservation, NO inline submission; manual runner submits and projects truthfully; backstop is a no-op; legacy path refuses", async () => {
    const { bookingId, jobId, payId, invId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });

    const r = await runCancel(adminUser(), { bookingId, reason: "changed plans", feeAction: "charge" }, "admin");
    expect(r).toMatchObject({ success: true, feePaise: 10000, refundPaise: 90000, manualRefund: false });
    expect((r as { refundRequestId?: string }).refundRequestId).toBeTruthy();

    // Reserve-only: the cancellation itself makes NO provider call. The
    // durable claim sits reserved with the real amount on the booking.
    expect(mockProvider.initiateRefundCallCount).toBe(0);
    {
      const reqId0 = (r as { refundRequestId?: string }).refundRequestId!;
      const req0 = (await db.collection(COLLECTIONS.refundRequests()).doc(reqId0).get()).data() as Record<string, unknown>;
      expect(req0.status).toBe("reserved");
      const booking0 = (await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>;
      expect(booking0.refundStatus).toBe("requested"); // truthful: requested, never claimed refunded
      expect(booking0.refundedPaise).toBe(0);
    }
    // The manual runner (the only submission path left) submits + projects.
    const first = await runRefundOutbox(db, mockProvider, { limit: 10 });
    expect(first).toMatchObject({ submitted: 1, projected: 1, failed: 0 });
    expect(mockProvider.initiateRefundCallCount).toBe(1); // exactly one provider submission end to end
    let pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect((pay.status as string)).toBe("partially_refunded"); // fee withheld: truthful partial
    expect(pay.refundAmount).toBe(90000);
    // The issued invoice is NEVER voided by the projection (credit-note hold).
    expect(((await db.collection(COLLECTIONS.invoices()).doc(invId).get()).data() as { status: string }).status).toBe("issued");
    // Requested -> processed: the booking carries the REAL amount and id.
    const booking = (await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>;
    expect(booking.status).toBe("CANCELLED");
    expect(booking.refundStatus).toBe("processed");
    expect(booking.refundRequestId).toBeTruthy();
    expect(booking.refundedPaise).toBe(90000);
    expect(booking.refundId).toBeTruthy();
    expect(booking.refundRequestedPaise).toBe(90000);
    const req = (await db.collection(COLLECTIONS.refundRequests()).doc(booking.refundRequestId as string).get()).data() as Record<string, unknown>;
    expect(req.status).toBe("projected");

    // Backstop: a manual runner pass is a truthful no-op (idempotent).
    const out = await runRefundOutbox(db, mockProvider, { limit: 10 });
    expect(out).toMatchObject({ submitted: 0, projected: 0, failed: 0 });
    expect(mockProvider.initiateRefundCallCount).toBe(1); // never resubmitted
    pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.refundAmount).toBe(90000);

    // Interlock: the legacy manual path refuses on the same payment.
    await expect(initiateRefund.run({ data: { paymentId: payId, reason: "second" }, auth: adminAuth() } as never))
      .rejects.toThrow();
    const job = (await db.collection(COLLECTIONS.jobs()).doc(jobId).get()).data() as Record<string, unknown>;
    expect(job.status).toBe("CANCELLED");
    expect(job.paymentStatus).toBe("partial");
  });

  it("manual runner provider failure: request HOLDS with the reason on it (never resubmitted), a later runner pass reconciles and completes", async () => {
    const { bookingId, payId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    const r = await runCancel(adminUser(), { bookingId, reason: "changed plans", feeAction: "waive" }, "admin");
    expect(r).toMatchObject({ success: true, refundPaise: 100000 }); // the cancellation itself succeeded
    expect(mockProvider.initiateRefundCallCount).toBe(0); // reserve-only: no inline submission
    // The provider-side refund lands in "failed" status and the response is
    // lost: a failure NOTIFICATION, not settled finality - the runner must
    // hold, not project and not resubmit.
    mockProvider.failNextRefund = true;
    const failed = await runRefundOutbox(db, mockProvider, { limit: 10 });
    expect(failed.failed).toBe(1);
    expect(mockProvider.initiateRefundCallCount).toBe(1); // submitted exactly once
    let pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.refundAmount ?? null).toBeNull(); // nothing projected on failed evidence
    const reqId = (r as { refundRequestId?: string }).refundRequestId!;
    let req = (await db.collection(COLLECTIONS.refundRequests()).doc(reqId).get()).data() as Record<string, unknown>;
    expect(req.status).toBe("ambiguous"); // durable hold
    expect(String(req.lastError)).toMatch(/failed/); // the reason is ON the request

    // The "failed" notification turns out to be wrong (the refund actually
    // processed): the manual runner reconciles via the bound lookup - with
    // NO new submission - and projects.
    mockProvider.setStoredRefundStatus(reqId, "processed");
    const out = await runRefundOutbox(db, mockProvider, { limit: 10 });
    // "submitted" counts the request's reconciliation to submitted state,
    // NOT a provider call: the provider submission count stays at one.
    expect(out).toMatchObject({ submitted: 1, projected: 1, failed: 0 });
    expect(mockProvider.initiateRefundCallCount).toBe(1); // still exactly one provider refund
    pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(100000);
    req = (await db.collection(COLLECTIONS.refundRequests()).doc(reqId).get()).data() as Record<string, unknown>;
    expect(req.status).toBe("projected");
    void bookingId;
  });

  it("waived fee: full refund reserved with NO inline submission, then submitted by the manual runner and projected as fully refunded", async () => {
    const { bookingId, payId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    const r = await runCancel(adminUser(), { bookingId, reason: "studio cannot take it", feeAction: "waive" }, "admin");
    expect(r).toMatchObject({ success: true, feePaise: 0, refundPaise: 100000 });
    expect(mockProvider.initiateRefundCallCount).toBe(0); // reserve-only
    const out = await runRefundOutbox(db, mockProvider, { limit: 10 });
    expect(out).toMatchObject({ submitted: 1, projected: 1, failed: 0 }); // the runner settles it
    expect(mockProvider.initiateRefundCallCount).toBe(1);
    const pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(100000);
    void bookingId;
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
    // Interleave: work starts on the job AFTER runCancel's initial reads but
    // BEFORE its cancellation transaction begins - the transaction's fresh
    // revalidation must refuse, and nothing may survive. (Writing the job
    // from outside an OPEN transaction would deadlock against its locks in
    // the emulator, so the barrier fires before the transaction starts.)
    const origRun = db.runTransaction.bind(db);
    let interleaved = false;
    (db as unknown as { runTransaction: unknown }).runTransaction = async (cb: (tx: unknown) => Promise<unknown>) => {
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
    const out = await runRefundOutbox(db, mockProvider, { limit: 10 });
    expect(out).toMatchObject({ submitted: 0, projected: 0, failed: 0 });
    expect(mockProvider.initiateRefundCallCount).toBe(0);
  });

  it("double-tap: two concurrent cancels commit exactly ONE reservation and ONE cancellation", { timeout: 45000 }, async () => {
    const { bookingId, payId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    const [r1, r2] = await Promise.allSettled([
      runCancel(adminUser(), { bookingId, reason: "tap1", feeAction: "waive" }, "admin"),
      runCancel(adminUser(), { bookingId, reason: "tap2", feeAction: "waive" }, "admin"),
    ]);
    const ok = [r1, r2].filter((r) => r.status === "fulfilled");
    expect(ok.length).toBe(1);
    const reqs = await db.collection(COLLECTIONS.refundRequests()).get();
    expect(reqs.docs.filter((d) => d.id.startsWith("rr_")).length).toBe(1);
    expect(mockProvider.initiateRefundCallCount).toBe(0); // reserve-only: NEITHER cancel submits inline
    const out = await runRefundOutbox(db, mockProvider, { limit: 10 });
    expect(out).toMatchObject({ submitted: 1, projected: 1, failed: 0 }); // one runner pass settles the single reservation
    expect(mockProvider.initiateRefundCallCount).toBe(1);
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

describe("cross-vintage interlock (old Oct-20 producer vs outbox reservation)", () => {
  // Faithful simulation of the DEPLOYED Oct-20 producer's claim transaction
  // (verified against the live console source): it reads the booking, the
  // payment and the claim doc; refuses when the booking is already CANCELLED
  // or the payment is no longer "completed" or a claim exists; else claims.
  const legacyClaimTx = async (payId: string, bookingId: string) => {
    const ref = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${payId}`);
    const bookingRef = db.collection(COLLECTIONS.bookings()).doc(bookingId);
    const paymentRef = db.collection(COLLECTIONS.payments()).doc(payId);
    await db.runTransaction(async (tx) => {
      const [b, p, ev] = await Promise.all([tx.get(bookingRef), tx.get(paymentRef), tx.get(ref)]);
      if ((b.data() as { status?: string } | undefined)?.status === "CANCELLED") throw new Error("failed-precondition: This booking was just cancelled.");
      if ((p.data() as { status?: string } | undefined)?.status !== "completed") throw new Error("failed-precondition: The payment changed. Reload and try again.");
      if (ev.exists) throw new Error("already-exists: A refund has already been started for this payment.");
      tx.set(ref, { paymentId: payId, claimedAt: new Date().toISOString(), claimedBy: "legacy-sim", bookingId, amount: 90000 });
    });
  };

  it("legacy claim committed FIRST: the new cancellation refuses and neither cancels nor reserves nor submits", async () => {
    const { bookingId, payId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    await legacyClaimTx(payId, bookingId);
    await expect(runCancel(adminUser(), { bookingId, reason: "changed plans", feeAction: "charge" }, "admin"))
      .rejects.toThrow(/manual refund obligation/);
    const booking = (await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>;
    expect(booking.status).toBe("CONFIRMED");
    expect(mockProvider.initiateRefundCallCount).toBe(0);
    expect((await db.collection(COLLECTIONS.refundRequests()).get()).size).toBe(0);
  });

  it("reservation committed FIRST: while the reservation is ACTIVE the legacy claim transaction conflicts onto the tombstone and aborts before any provider call; after projection the tombstone is released", async () => {
    // Keep the refund pending at the provider so the reservation stays active
    // (the tombstone's lifetime is the active window by design).
    mockProvider.nextRefundStatus = "pending";
    const { bookingId, payId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    const r = await runCancel(adminUser(), { bookingId, reason: "changed plans", feeAction: "charge" }, "admin");
    expect(r.success).toBe(true);
    expect(mockProvider.initiateRefundCallCount).toBe(0); // reserve-only: the cancellation itself never calls the provider
    // The active reservation's tombstone carries the outbox marker.
    const tomb = (await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${payId}`).get()).data() as Record<string, unknown>;
    expect(tomb).toMatchObject({ claimedBy: "refund-outbox" });
    expect(typeof tomb.outboxRequestId).toBe("string");
    // The legacy producer's claim transaction now aborts - on the CANCELLED
    // booking read or on the tombstone's already-exists, both BEFORE any
    // provider call. (Two independent layers of the interlock.)
    await expect(legacyClaimTx(payId, bookingId)).rejects.toThrow(/already-exists|just cancelled/);
    expect(mockProvider.initiateRefundCallCount).toBe(0); // unchanged: still no submission anywhere
    // The manual runner submits (provider says pending: submitted, not yet
    // projected), then the provider reports processed and a pass projects:
    // the tombstone is released, the payment's own refunded status now blocks
    // legacy paths, and later partial refunds of the same payment are not wedged.
    const sub = await runRefundOutbox(db, mockProvider, { limit: 10 });
    expect(sub.submitted).toBe(1);
    expect(mockProvider.initiateRefundCallCount).toBe(1);
    mockProvider.setStoredRefundStatus((tomb.outboxRequestId as string), "processed");
    const out = await runRefundOutbox(db, mockProvider, { limit: 10 });
    expect(out.projected).toBe(1);
    expect((await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${payId}`).get()).exists).toBe(false);
    expect(mockProvider.initiateRefundCallCount).toBe(1);
  });
});

describe("payment mutations between preview read and commit", () => {
  it("barrier: a payment that starts PROCESSING before the transaction refuses the cancel - no refund, no reservation", { timeout: 30000 }, async () => {
    const { bookingId, payId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    const origRun = db.runTransaction.bind(db);
    let interleaved = false;
    (db as unknown as { runTransaction: unknown }).runTransaction = async (cb: (tx: unknown) => Promise<unknown>) => {
      if (!interleaved) {
        interleaved = true;
        await db.collection(COLLECTIONS.payments()).doc(payId).update({ status: "processing", updatedAt: new Date().toISOString() });
      }
      return origRun(cb);
    };
    await expect(runCancel(adminUser(), { bookingId, reason: "race", feeAction: "waive" }, "admin"))
      .rejects.toThrow(/still processing/);
    (db as unknown as { runTransaction: unknown }).runTransaction = origRun;
    expect(interleaved).toBe(true);
    expect(((await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>).status).toBe("CONFIRMED");
    expect((await db.collection(COLLECTIONS.refundRequests()).get()).empty).toBe(true);
    expect(mockProvider.initiateRefundCallCount).toBe(0);
  });

  it("barrier: a SECOND completed payment appearing before the transaction refuses the cancel - never refunds the wrong captured amount", { timeout: 30000 }, async () => {
    const { bookingId, jobId } = await seed({ method: "razorpay_payment_link", amount: 100000, scheduledInHrs: 2 });
    const origRun = db.runTransaction.bind(db);
    let interleaved = false;
    (db as unknown as { runTransaction: unknown }).runTransaction = async (cb: (tx: unknown) => Promise<unknown>) => {
      if (!interleaved) {
        interleaved = true;
        await db.collection(COLLECTIONS.payments()).doc("pay_late").set({
          id: "pay_late", tenantId: "t1", studioId: "s1", targetType: "job", jobId, bookingId,
          membershipId: null, giftId: null, customerId: "c1", amount: 40000, currency: "INR",
          method: "razorpay_payment_link", status: "completed", razorpayPaymentLinkId: "pl2",
          razorpayPaymentId: "rzp_pay_2", razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
          manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
          completedAt: new Date().toISOString(), failedAt: null, cancelledAt: null, refundedAt: null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
      }
      return origRun(cb);
    };
    await expect(runCancel(adminUser(), { bookingId, reason: "race", feeAction: "waive" }, "admin"))
      .rejects.toThrow(/more than one payment/);
    (db as unknown as { runTransaction: unknown }).runTransaction = origRun;
    expect(interleaved).toBe(true);
    expect(((await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>).status).toBe("CONFIRMED");
    expect((await db.collection(COLLECTIONS.refundRequests()).get()).empty).toBe(true);
    expect(mockProvider.initiateRefundCallCount).toBe(0);
  });
});

describe("refund ownership validation (both methods)", () => {
  it("manual path: a same-tenant payment linked to a DIFFERENT booking refuses the cancel - no payment/invoice writes", { timeout: 30000 }, async () => {
    const { bookingId, payId } = await seed({ method: "cash", amount: 100000, scheduledInHrs: 2 });
    await db.collection(COLLECTIONS.payments()).doc(payId).update({ bookingId: "bOTHER" });
    await expect(runCancel(adminUser(), { bookingId, reason: "changed plans", feeAction: "waive" }, "admin"))
      .rejects.toThrow(/no longer linked to this booking/);
    expect(((await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>).status).toBe("CONFIRMED");
    expect(((await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment).status).toBe("completed");
  });

  it("manual path: a foreign-studio payment refuses the cancel", { timeout: 30000 }, async () => {
    const { bookingId, payId } = await seed({ method: "cash", amount: 100000, scheduledInHrs: 2 });
    await db.collection(COLLECTIONS.payments()).doc(payId).update({ studioId: "sFOREIGN" });
    await expect(runCancel(adminUser(), { bookingId, reason: "changed plans", feeAction: "waive" }, "admin"))
      .rejects.toThrow(/does not belong to this booking's studio/);
    expect(((await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>).status).toBe("CONFIRMED");
  });
});

describe("bounded overflow behavior", () => {
  it("more than 10 payment records on the job fails closed", { timeout: 30000 }, async () => {
    const { bookingId, jobId } = await seed({ method: "cash", amount: 100000, scheduledInHrs: 2 });
    for (let n = 0; n < 11; n++) {
      await db.collection(COLLECTIONS.payments()).doc(`pay_extra_${n}`).set({
        id: `pay_extra_${n}`, tenantId: "t1", studioId: "s1", targetType: "job", jobId, bookingId,
        membershipId: null, giftId: null, customerId: "c1", amount: 100, currency: "INR",
        method: "cash", status: "pending", razorpayPaymentLinkId: null, razorpayPaymentId: null,
        razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
        manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
        completedAt: null, failedAt: null, cancelledAt: null, refundedAt: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    }
    await expect(runCancel(adminUser(), { bookingId, reason: "x reason", feeAction: "waive" }, "admin"))
      .rejects.toThrow(/too many payment records/);
    expect(((await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>).status).toBe("CONFIRMED");
  });

  it("a second job on the booking fails closed instead of silently picking one", { timeout: 30000 }, async () => {
    const { bookingId, jobId } = await seed({ method: "cash", amount: 100000, scheduledInHrs: 2 });
    await db.collection(COLLECTIONS.jobs()).doc("job_second").set({
      id: "job_second", tenantId: "t1", studioId: "s1", bookingId, status: "PENDING_VEHICLE",
      paymentStatus: "unpaid", statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await expect(runCancel(adminUser(), { bookingId, reason: "x reason", feeAction: "waive" }, "admin"))
      .rejects.toThrow(/more than one job/);
    expect(((await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>).status).toBe("CONFIRMED");
    void jobId;
  });
});

describe("invoice binding", () => {
  it("a same-tenant invoice linked to a different payment refuses the cancel", { timeout: 30000 }, async () => {
    const { bookingId, payId } = await seed({ method: "cash", amount: 100000, scheduledInHrs: 2 });
    const paySnap = await db.collection(COLLECTIONS.payments()).doc(payId).get();
    const invId = (paySnap.data() as Payment).invoiceId;
    expect(invId).toBeTruthy();
    await db.collection(COLLECTIONS.invoices()).doc(invId!).update({ paymentId: "payFOREIGN" });
    await expect(runCancel(adminUser(), { bookingId, reason: "changed plans", feeAction: "waive" }, "admin"))
      .rejects.toThrow(/does not belong to this payment/);
    expect(((await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Record<string, unknown>).status).toBe("CONFIRMED");
  });
});
