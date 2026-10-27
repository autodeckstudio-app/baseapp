/**
 * settleManualRefund: the admin-only close of a manual cancel refund
 * obligation. runCancel records money OWED (booking.manualRefundDuePaise +
 * the unmarked refund_<paymentId> claim); only when the office says the
 * cash/UPI/bank money was physically handed back does this callable mark the
 * payment refunded and clear the obligation. No provider is involved.
 * Local seeded fixtures only: no real refund, provider call or money.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { runCancel } from "../../functions/booking/adminCancelBooking.js";
import { settleManualRefund } from "../../functions/payment/settleManualRefund.js";

const db = getFirestore();
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;
const adminAuth = () => ({ uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" });
const studioAuth = () => ({ uid: uid("studio"), token: { role: "studio", tenantId: "t1", studioId: "s1" }, rawToken: "t" });
const otherTenantAdmin = () => ({ uid: uid("admin"), token: { role: "admin", tenantId: "t2", studioId: null }, rawToken: "t" });
const adminUser = () => ({ uid: uid("admin"), claims: { role: "admin", tenantId: "t1", studioId: null } }) as never;

async function seed(o: { method: string; amount?: number; tenant?: string }) {
  const bookingId = uid("b");
  const jobId = uid("job");
  const payId = uid("pay");
  const invId = uid("inv");
  const tenant = o.tenant ?? "t1";
  await db.collection(COLLECTIONS.bookings()).doc(bookingId).set({
    id: bookingId, tenantId: tenant, studioId: "s1", customerId: "c1", serviceId: "svc1",
    status: "CONFIRMED", scheduledAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
    totalAmount: o.amount ?? 100000, cancelCategories: [], paymentStatus: "paid",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.jobs()).doc(jobId).set({
    id: jobId, tenantId: tenant, studioId: "s1", bookingId, status: "PENDING_VEHICLE",
    paymentStatus: "paid", statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.payments()).doc(payId).set({
    id: payId, tenantId: tenant, studioId: "s1", targetType: "job", jobId, bookingId,
    membershipId: null, giftId: null, customerId: "c1", amount: o.amount ?? 100000, currency: "INR",
    method: o.method, status: "completed", razorpayPaymentLinkId: "pl1",
    razorpayPaymentId: o.method === "razorpay_payment_link" ? "rzp_pay_1" : null,
    razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: invId, providerEventId: null,
    completedAt: new Date().toISOString(), failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as Payment);
  await db.collection(COLLECTIONS.invoices()).doc(invId).set({
    id: invId, tenantId: tenant, studioId: "s1", jobId, bookingId, customerId: "c1",
    vehicleId: "v1", paymentId: payId, invoiceNumber: "INV-TEST-1",
    status: "issued", total: o.amount ?? 100000,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  return { bookingId, jobId, payId, invId };
}

/** Seed + cancel so the obligation exists (owed 90000 after a 10000 fee). */
async function seedOwed(method = "cash") {
  const ids = await seed({ method, amount: 100000 });
  const r = await runCancel(adminUser(), { bookingId: ids.bookingId, reason: "changed plans", feeAction: "charge" }, "admin");
  expect(r).toMatchObject({ success: true, manualRefund: method !== "razorpay_payment_link" });
  return ids;
}

beforeEach(async () => {
  for (const col of [COLLECTIONS.bookings(), COLLECTIONS.jobs(), COLLECTIONS.payments(), COLLECTIONS.invoices(), COLLECTIONS.refundRequests(), COLLECTIONS.paymentRefunds(), COLLECTIONS.paymentEvents(), COLLECTIONS.auditLog()]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe("settleManualRefund (office records the money actually returned)", () => {
  it("happy path: owed -> settled, payment refunded, obligation cleared, claim annotated, audit written; second settle refuses", async () => {
    const { bookingId, jobId, payId } = await seedOwed("cash");
    const r = (await settleManualRefund.run({ data: { paymentId: payId, note: "handed back at the counter" }, auth: adminAuth() } as never)) as { success: boolean; refundedPaise: number };
    expect(r).toMatchObject({ success: true, refundedPaise: 90000 });

    const pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(90000);
    expect(pay.razorpayRefundId).toBeNull();
    const b = (await db.collection(COLLECTIONS.bookings()).doc(bookingId).get()).data() as Booking;
    expect(b.manualRefundDuePaise ?? null).toBeNull();
    expect(b.refundedPaise).toBe(90000);
    const claim = (await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${payId}`).get()).data() as { settledAt?: string; settledBy?: string; settleNote?: string };
    expect(claim.settledAt).toBeTruthy();
    expect(claim.settleNote).toBe("handed back at the counter");
    const job = (await db.collection(COLLECTIONS.jobs()).doc(jobId).get()).data() as { paymentStatus: string };
    expect(job.paymentStatus).toBe("refunded");
    const audits = await db.collection(COLLECTIONS.auditLog()).where("entityId", "==", payId).get();
    expect(audits.size).toBe(1);
    expect(audits.docs[0]?.data().action).toBe("payment.refunded");

    await expect(settleManualRefund.run({ data: { paymentId: payId, note: "again" }, auth: adminAuth() } as never))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("studio staff can never settle: office-only money truth", async () => {
    const { payId } = await seedOwed("cash");
    await expect(settleManualRefund.run({ data: { paymentId: payId, note: "staff attempt" }, auth: studioAuth() } as never))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  it("cross-tenant admin is refused before any write", async () => {
    const { payId } = await seedOwed("cash");
    await expect(settleManualRefund.run({ data: { paymentId: payId, note: "wrong tenant" }, auth: otherTenantAdmin() } as never))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  it("razorpay payments are refused: provider money never settles by hand", async () => {
    const ids = await seed({ method: "razorpay_payment_link", amount: 100000 });
    await expect(settleManualRefund.run({ data: { paymentId: ids.payId, note: "hand attempt" }, auth: adminAuth() } as never))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("a completed manual payment with no open obligation cannot be settled here", async () => {
    const ids = await seed({ method: "upi_manual", amount: 50000 });
    await expect(settleManualRefund.run({ data: { paymentId: ids.payId, note: "no obligation" }, auth: adminAuth() } as never))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("the acknowledgement note is required", async () => {
    const { payId } = await seedOwed("cash");
    await expect(settleManualRefund.run({ data: { paymentId: payId }, auth: adminAuth() } as never))
      .rejects.toThrow();
  });

  it("obligation-marker tamper (amount drift) fails closed with zero financial writes", async () => {
    const { payId } = await seedOwed("cash");
    await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${payId}`).update({ amount: 1 });
    await expect(settleManualRefund.run({ data: { paymentId: payId, note: "drift" }, auth: adminAuth() } as never))
      .rejects.toMatchObject({ code: "unavailable" });
    const pay = (await db.collection(COLLECTIONS.payments()).doc(payId).get()).data() as Payment;
    expect(pay.status).toBe("completed");
  });
});
