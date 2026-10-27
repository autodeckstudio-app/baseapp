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
    id: jobId, tenantId: "t1", studioId: "s1", bookingId, status: "PENDING_VEHICLE",
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

const readBooking = async (id: string) => (await db.collection(COLLECTIONS.bookings()).doc(id).get()).data() as { status: string };
const readPayment = async (id: string) => (await db.collection(COLLECTIONS.payments()).doc(id).get()).data() as Payment;

beforeEach(() => {
  mockProvider.cancelLinkOutcomes.clear();
  mockProvider.cancelledLinkCalls.length = 0;
});

describe("Cancel closes the unpaid payment link first (provider-confirmed)", () => {
  it("cancel succeeds only after the provider confirms the link is dead; payment doc is closed with cancelledAt", async () => {
    const { bookingId, payId } = await seedPendingLink({ linkId: "plink_ok_1" });
    await runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin");
    expect(mockProvider.cancelledLinkCalls).toEqual(["plink_ok_1"]);
    expect((await readBooking(bookingId)).status).toBe("CANCELLED");
    const payment = await readPayment(payId);
    expect(payment.status).toBe("cancelled");
    expect(payment.cancelledAt).not.toBeNull();
  });

  it("already_inactive (expired/cancelled link) is the idempotent repeat: cancel proceeds", async () => {
    mockProvider.cancelLinkOutcomes.set("plink_dead_1", "already_inactive");
    const { bookingId, payId } = await seedPendingLink({ linkId: "plink_dead_1" });
    await runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin");
    expect((await readBooking(bookingId)).status).toBe("CANCELLED");
    expect((await readPayment(payId)).status).toBe("cancelled");
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
    // Retry once the lock clears: default outcome is cancelled.
    mockProvider.cancelLinkOutcomes.delete("plink_busy_1");
    await runCancel(adminUser(), { bookingId, reason: "customer asked", feeAction: "charge" }, "admin");
    expect((await readBooking(bookingId)).status).toBe("CANCELLED");
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
