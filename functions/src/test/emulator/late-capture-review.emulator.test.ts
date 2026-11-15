/**
 * Late-capture containment (B'): money arriving on a cancelled booking flags
 * itself into the office refund-review queue (invoiceReviewNeeded), and the
 * authorized refund route clears the flag - awareness only, no automatic
 * money movement. Mock provider only.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { listRefundWork } from "../../functions/payment/listRefundWork.js";
import { initiateRefund } from "../../functions/payment/initiateRefund.js";

async function seedPaidJobWithPendingLink() {
  const bookingId = uid("b");
  const jobId = uid("job");
  const payId = uid("pay");
  await db.collection(COLLECTIONS.bookings()).doc(bookingId).set({
    id: bookingId, tenantId: "t1", studioId: "s1", customerId: "c1", serviceId: "svc1",
    status: "CONFIRMED", scheduledAt: new Date(Date.now() + 2 * 3600_000).toISOString(), totalAmount: 100000,
    cancelCategories: [], paymentStatus: "paid",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.jobs()).doc(jobId).set({
    id: jobId, tenantId: "t1", studioId: "s1", bookingId, status: "IN_PROGRESS",
    paymentStatus: "paid", statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.payments()).doc(payId).set({
    id: payId, tenantId: "t1", studioId: "s1", targetType: "job", jobId, bookingId,
    membershipId: null, giftId: null, customerId: "c1", amount: 100000, currency: "INR",
    method: "razorpay_payment_link", status: "pending", razorpayPaymentLinkId: `plink_${payId}`,
    razorpayPaymentId: null, razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
    completedAt: null, failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as Payment);
  return { bookingId, jobId, payId };
}

async function seedMissingJobWithPendingLink() {
  const payId = uid("pay");
  await db.collection(COLLECTIONS.payments()).doc(payId).set({
    id: payId, tenantId: "t1", studioId: "s1", targetType: "job", jobId: uid("ghost-job"), bookingId: uid("ghost-booking"),
    membershipId: null, giftId: null, customerId: "c1", amount: 100000, currency: "INR",
    method: "razorpay_payment_link", status: "pending", razorpayPaymentLinkId: `plink_${payId}`,
    razorpayPaymentId: null, razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
    completedAt: null, failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as Payment);
  return { payId };
}

const captureLink = (payId: string) => processProviderEvent(db, {
  eventType: "payment_link.paid",
  providerEventId: uid("ev"),
  providerPaymentLinkId: `plink_${payId}`,
  providerPaymentId: `rzp_${payId}`,
  referenceId: payId,
  amount: 100000,
  currency: "INR",
} as never);

const getPay = (payId: string) => db.collection(COLLECTIONS.payments()).doc(payId).get().then((s) => s.data() as Payment & { invoiceReviewNeeded?: boolean });
const queueHas = async (payId: string) => {
  const work = await listRefundWork.run({ data: { knownClaimPaymentIds: [] }, auth: adminAuth() } as never) as { reviewPayments: { id: string }[] };
  return work.reviewPayments.some((x) => x.id === payId);
};

const db = getFirestore();
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;
const adminAuth = () => ({ uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" });

async function seedCancelledWithPendingLink() {
  const bookingId = uid("b");
  const jobId = uid("job");
  const payId = uid("pay");
  await db.collection(COLLECTIONS.bookings()).doc(bookingId).set({
    id: bookingId, tenantId: "t1", studioId: "s1", customerId: "c1", serviceId: "svc1",
    status: "CANCELLED", scheduledAt: new Date(Date.now() + 2 * 3600_000).toISOString(), totalAmount: 100000,
    cancelCategories: [], paymentStatus: "unpaid",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.jobs()).doc(jobId).set({
    id: jobId, tenantId: "t1", studioId: "s1", bookingId, status: "CANCELLED",
    paymentStatus: "unpaid", statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.payments()).doc(payId).set({
    id: payId, tenantId: "t1", studioId: "s1", targetType: "job", jobId, bookingId,
    membershipId: null, giftId: null, customerId: "c1", amount: 100000, currency: "INR",
    method: "razorpay_payment_link", status: "pending", razorpayPaymentLinkId: `plink_${payId}`,
    razorpayPaymentId: null, razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
    completedAt: null, failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as Payment);
  return { bookingId, jobId, payId };
}

describe("Late capture on a cancelled booking (B' containment)", () => {
  it("flags the payment into the office review queue; the authorized refund resolves it and clears the flag", async () => {
    const { payId } = await seedCancelledWithPendingLink();
    await processProviderEvent(db, {
      eventType: "payment_link.paid",
      providerEventId: uid("ev"),
      providerPaymentLinkId: `plink_${payId}`,
      providerPaymentId: `rzp_${payId}`,
      referenceId: payId,
      amount: 100000,
      currency: "INR",
    } as never);

    const captured = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment & { invoiceReviewNeeded?: boolean };
    expect(captured.status).toBe("completed");
    expect(captured.invoiceReviewNeeded).toBe(true);

    // Visible in the office queue (admin-only read path).
    const work = await listRefundWork.run({ data: { knownClaimPaymentIds: [] }, auth: adminAuth() } as never) as { reviewPayments: { id: string }[] };
    expect(work.reviewPayments.some((x) => x.id === payId)).toBe(true);

    // The existing authorized route refunds it (mock provider)...
    const result = (await initiateRefund.run({ data: { paymentId: payId, reason: "Paid after the booking was cancelled" }, auth: adminAuth() } as never)) as { refunded: boolean };
    expect(result.refunded).toBe(true);

    // ...and the flag clears, taking it out of the queue.
    const settled = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment & { invoiceReviewNeeded?: boolean };
    expect(settled.status).toBe("refunded");
    expect(settled.invoiceReviewNeeded).toBe(false);
    const workAfter = await listRefundWork.run({ data: { knownClaimPaymentIds: [] }, auth: adminAuth() } as never) as { reviewPayments: { id: string }[] };
    expect(workAfter.reviewPayments.some((x) => x.id === payId)).toBe(false);
  });

  it("double capture (job already paid) flags into the queue and the authorized refund clears it", async () => {
    const { payId } = await seedPaidJobWithPendingLink();
    await captureLink(payId);
    const captured = await getPay(payId);
    expect(captured.status).toBe("completed");
    expect(captured.invoiceReviewNeeded).toBe(true);
    expect(await queueHas(payId)).toBe(true);

    const result = (await initiateRefund.run({ data: { paymentId: payId, reason: "Duplicate capture on an already-paid job" }, auth: adminAuth() } as never)) as { refunded: boolean };
    expect(result.refunded).toBe(true);
    const settled = await getPay(payId);
    expect(settled.status).toBe("refunded");
    expect(settled.invoiceReviewNeeded).toBe(false);
    expect(await queueHas(payId)).toBe(false);
  });

  it("missing job flags into the queue and the flag PERSISTS while the refund is held (missing linked docs)", async () => {
    const { payId } = await seedMissingJobWithPendingLink();
    await captureLink(payId);
    const captured = await getPay(payId);
    expect(captured.status).toBe("completed");
    expect(captured.invoiceReviewNeeded).toBe(true);
    expect(await queueHas(payId)).toBe(true);

    // The authorized refund route refuses to fabricate writes against missing
    // linked docs (held for reconciliation) - so the review flag must survive.
    await expect(initiateRefund.run({ data: { paymentId: payId, reason: "Job record missing" }, auth: adminAuth() } as never)).rejects.toThrow();
    const held = await getPay(payId);
    expect(held.invoiceReviewNeeded).toBe(true);
    expect(await queueHas(payId)).toBe(true);
  });
});
