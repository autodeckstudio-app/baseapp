/**
 * Pay-after-cancel containment (Option A): when a booking with an UNPAID
 * pending Razorpay link is cancelled, the link must be confirmed dead at the
 * provider BEFORE the booking cancels. Provider semantics verified against the
 * official API docs 28 Oct 2026 (POST /v1/payment_links/:id/cancel):
 * paid/partially paid links refuse cancellation (fail-closed race signal),
 * expired/cancelled links are the idempotent repeat, and a short-lived
 * provider lock means retry. Mock provider only - no real provider calls.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { runCancel } from "../../functions/booking/adminCancelBooking.js";
import { mockProvider } from "../../lib/mock-payment-provider.js";

const db = getFirestore();
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;
const adminUser = () => ({ uid: uid("admin"), claims: { role: "admin", tenantId: "t1", studioId: null } }) as never;

async function seedPendingLink(o: { linkId: string | null }) {
  const bookingId = uid("b");
  const jobId = uid("job");
  const payId = uid("pay");
  const scheduledAt = new Date(Date.now() + 2 * 3600_000).toISOString();
  await db.collection(COLLECTIONS.bookings()).doc(bookingId).set({
    id: bookingId, tenantId: "t1", studioId: "s1", customerId: "c1", serviceId: "svc1",
    status: "CONFIRMED", scheduledAt, totalAmount: 100000,
    cancelCategories: [], paymentStatus: "unpaid",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.jobs()).doc(jobId).set({
    id: jobId, tenantId: "t1", studioId: "s1", bookingId, customerId: "c1", status: "PENDING_VEHICLE",
    paymentStatus: "unpaid", statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.payments()).doc(payId).set({
    id: payId, tenantId: "t1", studioId: "s1", targetType: "job", jobId, bookingId,
    membershipId: null, giftId: null, customerId: "c1", amount: 100000, currency: "INR",
    method: "razorpay_payment_link", status: "pending", razorpayPaymentLinkId: o.linkId,
    razorpayPaymentId: null, razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
    completedAt: null, failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as Payment);
  return { bookingId, payId };
}

const readBooking = async (id: string) => (await db.collection(COLLECTIONS.bookings()).doc(id).get()).data() as { status: string; cancelIntent?: { state: string } };
const readPayment = async (id: string) => (await db.collection(COLLECTIONS.payments()).doc(id).get()).data() as Payment;

beforeEach(() => {
  mockProvider.cancelLinkOutcomes.clear();
  mockProvider.cancelledLinkCalls.length = 0;
});

// Contract: eaecd4a2 (close the link at the provider first, fail closed) as AMENDED by the owner's
// 28 Oct 18:03 IST "okay make the safer flow" (WhatsApp, reply to the unpaid-online-cancellation question)
// and the 24 Oct ruling #2 (wait for the gateway result, then cancel and record the refund): a provider-closed
// link only blocks NEW attempts (https://razorpay.com/docs/payments/payment-links/states), so after the link is
// closed the booking is RETAINED with cancelIntent "waiting" instead of being cancelled; a later capture resolves
// it (waiting-cancel*.emulator.test.ts). The fail-closed provider outcomes below are unchanged.
describe("Cancel closes the unpaid payment link first (provider-confirmed)", () => {
  it("provider confirms the link is closed -> booking is RETAINED waiting for the payment result (not cancelled, not paid)", async () => {
    const { bookingId, payId } = await seedPendingLink({ linkId: "plink_ok_1" });
    await runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin");
    expect(mockProvider.cancelledLinkCalls).toEqual(["plink_ok_1"]);
    const booking = await readBooking(bookingId);
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.cancelIntent?.state).toBe("waiting");
    expect((await readPayment(payId)).status).toBe("pending");
  });

  it("already_inactive (expired/cancelled link) is the idempotent repeat: still retained, a closed link never proves no payment is in flight", async () => {
    mockProvider.cancelLinkOutcomes.set("plink_dead_1", "already_inactive");
    const { bookingId, payId } = await seedPendingLink({ linkId: "plink_dead_1" });
    await runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin");
    const booking = await readBooking(bookingId);
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.cancelIntent?.state).toBe("waiting");
    expect((await readPayment(payId)).status).toBe("pending");
  });

  it("RACE: provider says the link is already paid -> cancel refuses, booking and payment stay untouched", async () => {
    mockProvider.cancelLinkOutcomes.set("plink_paid_1", "already_paid");
    const { bookingId, payId } = await seedPendingLink({ linkId: "plink_paid_1" });
    await expect(
      runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin"),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await readBooking(bookingId)).status).toBe("CONFIRMED");
    expect((await readPayment(payId)).status).toBe("pending");
  });

  it("provider lock (update in progress) -> unavailable, booking NOT cancelled, safe to retry", async () => {
    mockProvider.cancelLinkOutcomes.set("plink_busy_1", "in_progress");
    const { bookingId, payId } = await seedPendingLink({ linkId: "plink_busy_1" });
    await expect(
      runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin"),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect((await readBooking(bookingId)).status).toBe("CONFIRMED");
    expect((await readPayment(payId)).status).toBe("pending");
    // Retry once the lock clears: default outcome is cancelled, so the booking is retained waiting.
    mockProvider.cancelLinkOutcomes.delete("plink_busy_1");
    await runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin");
    const retried = await readBooking(bookingId);
    expect(retried.status).toBe("CONFIRMED");
    expect(retried.cancelIntent?.state).toBe("waiting");
  });

  it("pending link missing its provider link id -> integrity stop, nothing cancelled", async () => {
    const { bookingId, payId } = await seedPendingLink({ linkId: null });
    await expect(
      runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin"),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await readBooking(bookingId)).status).toBe("CONFIRMED");
    expect((await readPayment(payId)).status).toBe("pending");
    expect(mockProvider.cancelledLinkCalls).toEqual([]);
  });
});

// Contract: 28 Oct 18:03 IST "okay make the safer flow" + 24 Oct ruling #2 (an open online payment is never instant-cancelled).
// RACE: the pre-transaction payment snapshot sees NO online payment, then one appears before the cancellation transaction commits.
// The booking must not be cancelled (the new link was never closed at the provider). The race is injected deterministically by
// writing the payment from inside the pre-transaction service read, which happens after the payment snapshot and before the tx.
describe("Online payment that appears between the snapshot and the cancellation transaction", () => {
  it("fails closed: booking stays CONFIRMED, the new pending link is untouched", async () => {
    const bookingId = uid("b"); const jobId = uid("job"); const payId = uid("pay"); const serviceId = uid("svc");
    const now = new Date().toISOString();
    await db.collection(COLLECTIONS.bookings()).doc(bookingId).set({
      id: bookingId, tenantId: "t1", studioId: "s1", customerId: "c1", serviceId, status: "CONFIRMED",
      scheduledAt: new Date(Date.now() + 2 * 3600_000).toISOString(), totalAmount: 100000, cancelCategories: [], paymentStatus: "unpaid", createdAt: now, updatedAt: now,
    });
    await db.collection(COLLECTIONS.jobs()).doc(jobId).set({
      id: jobId, tenantId: "t1", studioId: "s1", bookingId, customerId: "c1", status: "PENDING_VEHICLE", paymentStatus: "unpaid", statusHistory: [], createdAt: now, updatedAt: now,
    });
    await db.collection(COLLECTIONS.services()).doc(serviceId).set({ id: serviceId, tenantId: "t1", category: "detailing" });
    const proto = Object.getPrototypeOf(db.collection(COLLECTIONS.services()).doc(serviceId));
    const realGet = proto.get;
    let injected = false;
    proto.get = async function (this: { path: string }, ...a: unknown[]) {
      const r = await realGet.apply(this, a);
      if (!injected && this.path === `${COLLECTIONS.services()}/${serviceId}`) {
        injected = true;
        await db.collection(COLLECTIONS.payments()).doc(payId).set({
          id: payId, tenantId: "t1", studioId: "s1", targetType: "job", jobId, bookingId, membershipId: null, giftId: null, customerId: "c1",
          amount: 100000, currency: "INR", method: "razorpay_payment_link", status: "pending", razorpayPaymentLinkId: "plink_race_1",
          razorpayPaymentId: null, razorpayOrderId: null, razorpayRefundId: null, refundAmount: null, manualReference: null, recordedBy: null,
          invoiceId: null, providerEventId: null, completedAt: null, failedAt: null, cancelledAt: null, refundedAt: null, createdAt: now, updatedAt: now,
        } as Payment);
      }
      return r;
    };
    try {
      await expect(runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin")).rejects.toMatchObject({ code: "failed-precondition" });
    } finally { proto.get = realGet; }
    expect(injected).toBe(true);
    expect((await readBooking(bookingId)).status).toBe("CONFIRMED");
    expect((await readPayment(payId)).status).toBe("pending");
    // Retry with the payment now visible takes the waiting path (link closed at the provider, booking retained).
    await runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin");
    expect(mockProvider.cancelledLinkCalls).toContain("plink_race_1");
    expect((await readBooking(bookingId)).cancelIntent?.state).toBe("waiting");
  });
});
