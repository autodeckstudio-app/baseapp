/**
 * Emulator tests for the cancel and refund arithmetic as it actually runs (adminCancelBooking.runCancel),
 * with documents seeded directly so the time to the slot is exact. Local only: cash payments, no provider call.
 * Covers: early cancel full refund with no processing deduction, the Rs 100 / 20% bands, studio cancel with
 * same-value compensation recorded as DUE (nothing is paid out), goodwill waive kept distinct from a studio cancel,
 * idempotency and the admin-only guard.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { adminCancelBooking } from "../../functions/booking/adminCancelBooking.js";

const db = getFirestore();
const TENANT = "cm-tenant";
const STUDIO = "cm-studio";
const H = 3600000;
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${(seq += 1)}`;
const adminAuth = (u: string) => ({ uid: u, token: { role: "admin", tenantId: TENANT, studioId: null }, rawToken: "test" });
const customerAuth = (u: string) => ({ uid: u, token: { role: "customer", tenantId: TENANT, studioId: null }, rawToken: "test" });

type Seeded = { bookingId: string; paymentId: string | null };

async function seed(opts: { category: string; hoursBefore: number; totalPaise: number; paidPaise: number }): Promise<Seeded> {
  const now = new Date().toISOString();
  const bookingId = uid("bk");
  const jobId = uid("job");
  const serviceId = uid("svc");
  const customerId = uid("cust");
  const scheduledAt = new Date(Date.now() + opts.hoursBefore * H).toISOString();
  await db.collection("services").doc(serviceId).set({ id: serviceId, tenantId: TENANT, category: opts.category });
  await db.collection("bookings").doc(bookingId).set({
    id: bookingId, tenantId: TENANT, studioId: STUDIO, customerId, serviceId, status: "CONFIRMED",
    scheduledAt, totalAmount: opts.totalPaise, cancelCategories: [opts.category], createdAt: now, updatedAt: now,
  });
  await db.collection("jobs").doc(jobId).set({
    id: jobId, tenantId: TENANT, studioId: STUDIO, bookingId, customerId, status: "PENDING_VEHICLE", statusHistory: [], createdAt: now, updatedAt: now,
  });
  let paymentId: string | null = null;
  if (opts.paidPaise > 0) {
    paymentId = uid("pay");
    await db.collection("payments").doc(paymentId).set({
      id: paymentId, tenantId: TENANT, studioId: STUDIO, jobId, bookingId, customerId, amount: opts.paidPaise, currency: "INR",
      method: "cash", status: "completed", invoiceId: null, razorpayPaymentId: null, createdAt: now, updatedAt: now,
    });
  }
  return { bookingId, paymentId };
}

const cancel = (bookingId: string, feeAction: "charge" | "waive" | "studio", preview = false) =>
  adminCancelBooking.run({ data: { bookingId, reason: "test cancel", feeAction, preview }, auth: adminAuth(uid("admin")) } as never) as Promise<Record<string, unknown>>;
const booking = async (id: string) => (await db.collection("bookings").doc(id).get()).data() as Record<string, unknown>;

describe("cancel and refund money (cash only, no provider)", () => {
  it("wash cancelled 10h before the slot: free, refund equals what was paid, no processing deduction", async () => {
    const s = await seed({ category: "washing", hoursBefore: 10, totalPaise: 100000, paidPaise: 100000 });
    expect(await cancel(s.bookingId, "charge", true)).toMatchObject({ preview: true, policyFeePaise: 0, feePaise: 0, refundPaise: 100000, paidPaise: 100000 });
    expect(await cancel(s.bookingId, "charge")).toMatchObject({ success: true, refundPaise: 100000, manualRefund: true });
    // Cash: money is OWED, not returned. Nothing may say "refunded" or "initiated"; payment stays completed.
    const pay = (await db.collection("payments").doc(s.paymentId!).get()).data()!;
    expect(pay["status"]).toBe("completed"); expect(pay["refundAmount"]).toBeUndefined(); expect(pay["refundedAt"]).toBeUndefined();
    const b = await booking(s.bookingId);
    expect(b).toMatchObject({ status: "CANCELLED", manualRefundDuePaise: 100000, cancellationFeePaise: 0 });
    expect(b["refundStatus"]).toBeUndefined(); expect(b["refundedPaise"]).toBeUndefined(); expect(b["refundId"]).toBeUndefined();
    expect(b["paymentStatus"]).not.toBe("refunded");
  });

  it("wash cancelled 2h before the slot: Rs 100 is withheld, the rest is refunded", async () => {
    const s = await seed({ category: "washing", hoursBefore: 2, totalPaise: 100000, paidPaise: 100000 });
    expect(await cancel(s.bookingId, "charge")).toMatchObject({ policyFeePaise: 10000, feePaise: 10000, refundPaise: 90000, feeStatus: "withheld" });
    expect(await booking(s.bookingId)).toMatchObject({ cancellationFeePaise: 10000, cancellationFeeStatus: "withheld", manualRefundDuePaise: 90000 });
  });

  it("bigger service (PPF) 30h before: free, full refund; 20h before: 20% withheld and 80% refunded", async () => {
    const early = await seed({ category: "ppf", hoursBefore: 30, totalPaise: 500000, paidPaise: 500000 });
    expect(await cancel(early.bookingId, "charge")).toMatchObject({ feePaise: 0, refundPaise: 500000 });
    const late = await seed({ category: "ppf", hoursBefore: 20, totalPaise: 500000, paidPaise: 500000 });
    expect(await cancel(late.bookingId, "charge")).toMatchObject({ policyFeePaise: 100000, feePaise: 100000, refundPaise: 400000 });
  });

  it("second cancel of the same booking changes nothing (idempotent)", async () => {
    const s = await seed({ category: "washing", hoursBefore: 2, totalPaise: 100000, paidPaise: 100000 });
    await cancel(s.bookingId, "charge");
    expect(await cancel(s.bookingId, "charge")).toMatchObject({ success: true, alreadyCancelled: true });
    expect((await db.collection("payments").doc(s.paymentId!).get()).data()).toMatchObject({ status: "completed" });
    expect((await booking(s.bookingId))["manualRefundDuePaise"]).toBe(90000); // one obligation, unchanged by the re-cancel
  });

  it("studio cancel inside the customer's fee window: full refund and Rs 100 compensation recorded as due, cash not credit", async () => {
    const s = await seed({ category: "washing", hoursBefore: 2, totalPaise: 100000, paidPaise: 100000 });
    expect(await cancel(s.bookingId, "studio", true)).toMatchObject({ preview: true, refundPaise: 100000, feePaise: 0, studioCompensationPaise: 10000 });
    expect(await cancel(s.bookingId, "studio")).toMatchObject({ refundPaise: 100000, studioCompensationPaise: 10000 });
    expect(await booking(s.bookingId)).toMatchObject({
      status: "CANCELLED", cancelledByStudio: true, manualRefundDuePaise: 100000, studioCompensationPaise: 10000, studioCompensationStatus: "due",
    });
  });

  it("studio cancel of a bigger job inside 24h records 20% of the total as compensation, even when nothing was paid", async () => {
    const s = await seed({ category: "ppf", hoursBefore: 20, totalPaise: 500000, paidPaise: 0 });
    expect(await cancel(s.bookingId, "studio")).toMatchObject({ refundPaise: 0, studioCompensationPaise: 100000 });
    expect(await booking(s.bookingId)).toMatchObject({ studioCompensationPaise: 100000, studioCompensationStatus: "due" });
  });

  it("studio cancel while the customer's free window still holds records no compensation", async () => {
    const s = await seed({ category: "washing", hoursBefore: 10, totalPaise: 100000, paidPaise: 100000 });
    await cancel(s.bookingId, "studio");
    const b = await booking(s.bookingId);
    expect(b).toMatchObject({ cancelledByStudio: true, manualRefundDuePaise: 100000 });
    expect(b["studioCompensationPaise"]).toBeUndefined();
    expect(b["studioCompensationStatus"]).toBeUndefined();
  });

  it("a goodwill waive stays distinct from a studio cancel: full refund, no compensation, not marked studio", async () => {
    const s = await seed({ category: "washing", hoursBefore: 2, totalPaise: 100000, paidPaise: 100000 });
    expect(await cancel(s.bookingId, "waive")).toMatchObject({ refundPaise: 100000, feePaise: 0, feeStatus: "waived" });
    const b = await booking(s.bookingId);
    expect(b["cancelledByStudio"]).toBeUndefined();
    expect(b["studioCompensationPaise"]).toBeUndefined();
  });

  it("a customer cannot call the admin cancel, so cannot pick the studio action", async () => {
    const s = await seed({ category: "washing", hoursBefore: 2, totalPaise: 100000, paidPaise: 100000 });
    await expect(
      adminCancelBooking.run({ data: { bookingId: s.bookingId, reason: "test cancel", feeAction: "studio" }, auth: customerAuth(uid("c")) } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
    const after = await booking(s.bookingId);
    expect(after["status"]).toBe("CONFIRMED");
    expect(after["cancelledByStudio"]).toBeUndefined();
    expect(after["studioCompensationStatus"]).toBeUndefined();
    expect((await db.collection("payments").doc(s.paymentId!).get()).data()).toMatchObject({ status: "completed" });
  });
});

describe("manual refund DUE guards (real emulator)", () => {
  it("a provider refund can never be reserved on a payment that carries a manual obligation; the cancelled job is never deliverable", async () => {
    const { reserveRefund } = await import("../../lib/refund-outbox.js");
    const s = await seed({ category: "washing", hoursBefore: 10, totalPaise: 100000, paidPaise: 100000 });
    await cancel(s.bookingId, "charge");
    const p = (await db.collection("payments").doc(s.paymentId!).get()).data() as never;
    await expect(reserveRefund(db, { payment: p, amountPaise: 100000, reason: "x", createdBy: "a1" })).rejects.toThrow(/manual refund obligation/);
    expect((await db.collection("refundRequests").where("paymentId", "==", s.paymentId!).get()).size).toBe(0);
    const jobs = await db.collection("jobs").where("bookingId", "==", s.bookingId).get();
    expect(jobs.docs[0]!.data()["status"]).toBe("CANCELLED");
    const { advanceJobStatus } = await import("../../functions/job/advanceJobStatus.js");
    const studioAuth = { uid: uid("st"), token: { role: "studio", tenantId: TENANT, studioId: STUDIO }, rawToken: "t" };
    await expect(advanceJobStatus.run({ data: { jobId: jobs.docs[0]!.id }, auth: studioAuth } as never)).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await db.collection("jobs").doc(jobs.docs[0]!.id).get()).data()!["status"]).toBe("CANCELLED");
  });
  it("audit carries the obligation, not a refund: refundedPaise 0, manualRefundDuePaise set", async () => {
    const s = await seed({ category: "washing", hoursBefore: 10, totalPaise: 100000, paidPaise: 100000 });
    await cancel(s.bookingId, "charge");
    const logs = (await db.collection("auditLog").where("entityId", "==", s.bookingId).get()).docs.map((d) => d.data()).filter((l) => l["action"] === "booking.cancelled");
    expect(logs).toHaveLength(1);
    expect((logs[0]!["after"] as Record<string, unknown>)).toMatchObject({ refundedPaise: 0, manualRefundDuePaise: 100000 });
  });
  it("two concurrent admin cancels leave exactly one obligation", async () => {
    const s = await seed({ category: "washing", hoursBefore: 10, totalPaise: 100000, paidPaise: 100000 });
    await Promise.allSettled([cancel(s.bookingId, "charge"), cancel(s.bookingId, "charge")]);
    expect((await booking(s.bookingId))["manualRefundDuePaise"]).toBe(100000);
    expect((await db.collection("paymentEvents").doc(`refund_${s.paymentId}`).get()).exists).toBe(true);
  });
});
