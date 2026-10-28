/**
 * Emulator tests for the cancel and refund arithmetic as it actually runs (adminCancelBooking.runCancel),
 * with documents seeded directly so the time to the slot is exact. Local only: cash payments, no provider call.
 * Covers: early cancel full refund with no processing deduction, the Rs 100 / 20% bands, studio cancel with
 * full actual-paid refund and no new compensation obligation, goodwill waive kept distinct from a studio cancel,
 * idempotency and the admin-only guard.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { adminCancelBooking } from "../../functions/booking/adminCancelBooking.js";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";

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
    expect(b["refundStatus"]).toBeUndefined(); expect(b["refundId"]).toBeUndefined();
    // refundedPaise only counts money actually sent back: truthful 0 at cancel time (absent and 0 are equivalent to every reader); never positive here.
    expect(b["refundedPaise"] ?? 0).toBe(0);
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

  it.each([
    { category: "washing", hoursBefore: 2, totalPaise: 100000, paidPaise: 100000 },
    { category: "ppf", hoursBefore: 20, totalPaise: 500000, paidPaise: 500000 },
    { category: "ppf", hoursBefore: 20, totalPaise: 500000, paidPaise: 0 },
  ])("studio cancel (feeAction waive) refunds actual paid without NEW compensation: $category paid=$paidPaise", async (opts) => {
    const s = await seed(opts);
    const preview = await cancel(s.bookingId, "waive", true);
    const result = await cancel(s.bookingId, "waive");
    for (const value of [preview, result, await booking(s.bookingId)]) {
      expect(value["studioCompensationPaise"]).toBeUndefined();
      expect(value["studioCompensationStatus"]).toBeUndefined();
    }
    expect(preview).toMatchObject({ preview: true, refundPaise: opts.paidPaise, feePaise: 0 });
    expect(result).toMatchObject({ success: true, refundPaise: opts.paidPaise });
    const b = await booking(s.bookingId);
    // Contract (f5887a26, 24 Oct 2026): a studio cancel is feeAction "waive" (schema: "waive = studio cancelled or goodwill"); the separate
    // "studio" action and its cancelledByStudio marker were removed, and no new compensation obligation is recorded.
    expect(b).toMatchObject({ status: "CANCELLED" });
    expect(b["cancelledByStudio"]).toBeUndefined();
    expect(b["manualRefundDuePaise"]).toBe(opts.paidPaise || undefined);
    const audit = await db.collection("auditLog").where("entityId", "==", s.bookingId).get();
    expect(audit.size).toBe(1);
    for (const row of audit.docs) {
      expect(row.data()["after"]["studioCompensationPaise"]).toBeUndefined();
      expect(row.data()["after"]["studioCompensationStatus"]).toBeUndefined();
    }
  });

  it("historical compensation due and prior audit survive cancellation and retry untouched", async () => {
    const s = await seed({ category: "washing", hoursBefore: 2, totalPaise: 100000, paidPaise: 100000 });
    const historical = { studioCompensationPaise: 12345, studioCompensationStatus: "due" };
    await db.collection("bookings").doc(s.bookingId).update(historical);
    const oldAudit = db.collection("auditLog").doc(uid("historical"));
    const oldRecord = { entityId: s.bookingId, action: "historical.compensation", after: historical };
    await oldAudit.set(oldRecord);
    await cancel(s.bookingId, "waive");
    expect(await booking(s.bookingId)).toMatchObject({ ...historical, manualRefundDuePaise: 100000 });
    const beforeRetry = await booking(s.bookingId);
    expect(await cancel(s.bookingId, "waive")).toMatchObject({ alreadyCancelled: true });
    expect(await booking(s.bookingId)).toEqual(beforeRetry);
    expect((await oldAudit.get()).data()).toEqual(oldRecord);
    const audits = await db.collection("auditLog").where("entityId", "==", s.bookingId).get();
    expect(audits.size).toBe(2);
    const newAudit = audits.docs.find(d => d.id !== oldAudit.id);
    expect(newAudit).toBeDefined();
    if (!newAudit) throw new Error("New cancellation audit missing");
    expect(newAudit.data()["after"]["studioCompensationPaise"]).toBeUndefined();
    expect(newAudit.data()["after"]["studioCompensationStatus"]).toBeUndefined();
  });

  it("studio cancel while the customer's free window still holds records no compensation", async () => {
    const s = await seed({ category: "washing", hoursBefore: 10, totalPaise: 100000, paidPaise: 100000 });
    await cancel(s.bookingId, "waive");
    const b = await booking(s.bookingId);
    expect(b).toMatchObject({ manualRefundDuePaise: 100000 });
    expect(b["cancelledByStudio"]).toBeUndefined();
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

  it("TEST (current behaviour, not a policy): gifted booking with cash extras - owed is the extras only, the gift purchase payment is untouched, the gift goes back to ACTIVE", async () => {
    const s = await seed({ category: "washing", hoursBefore: 10, totalPaise: 20000, paidPaise: 20000 });
    const giftId = uid("gift");
    const giftPayId = uid("gpay");
    const now = new Date().toISOString();
    await db.collection("bookings").doc(s.bookingId).update({ giftId });
    await db.collection("gifts").doc(giftId).set({ id: giftId, tenantId: TENANT, status: "REDEEMED", redeemedBy: "u", redeemedAt: now, bookingId: s.bookingId });
    await db.collection("payments").doc(giftPayId).set({ id: giftPayId, tenantId: TENANT, studioId: null, targetType: "gift", giftId, jobId: null, bookingId: null, amount: 150000, currency: "INR", method: "razorpay", status: "completed", createdAt: now, updatedAt: now });
    expect(await cancel(s.bookingId, "charge")).toMatchObject({ success: true, refundPaise: 20000, manualRefund: true });
    expect(await booking(s.bookingId)).toMatchObject({ status: "CANCELLED", manualRefundDuePaise: 20000 });
    expect((await db.collection("gifts").doc(giftId).get()).data()).toMatchObject({ status: "ACTIVE", bookingId: null });
    const gp = (await db.collection("payments").doc(giftPayId).get()).data()!;
    expect(gp["status"]).toBe("completed"); expect(gp["refundedAt"]).toBeUndefined();
  });
});

// TEST. Customer SELF-cancel of a completed CASH payment goes through the same runCancel (actor customer, feeAction forced to "charge").
// Money is recorded as OWED (booking.manualRefundDuePaise), payment stays completed, invoice untouched. No fee choice for the customer.
describe("customer self-cancel of a completed cash payment (cancelBooking, customer entry)", () => {
  const selfCancel = (bookingId: string, uidOf: string, tenant = TENANT) =>
    cancelBooking.run({ data: { bookingId, reason: "customer cancel", customerContext: true }, auth: { uid: uidOf, token: { role: "customer", tenantId: tenant, studioId: null }, rawToken: "test" } } as never) as Promise<Record<string, unknown>>;
  const ownerOf = async (id: string) => String((await booking(id))["customerId"]);

  it("OUTSIDE the fee window (10h): owed equals what was paid, no fee, payment completed, no refund claim of 'refunded'", async () => {
    const s = await seed({ category: "washing", hoursBefore: 10, totalPaise: 100000, paidPaise: 100000 });
    const res = await selfCancel(s.bookingId, await ownerOf(s.bookingId));
    expect(res).toMatchObject({ success: true, manualRefund: true, refundPaise: 100000, providerRefundId: null });
    expect(await booking(s.bookingId)).toMatchObject({ status: "CANCELLED", manualRefundDuePaise: 100000, cancellationFeePaise: 0 });
    const pay = (await db.collection("payments").doc(s.paymentId!).get()).data()!;
    expect(pay["status"]).toBe("completed");
    expect((await db.collection("paymentEvents").doc(`refund_${s.paymentId}`).get()).exists).toBe(true);
  });

  it("INSIDE the fee window (2h): the policy fee is charged with no customer choice, owed = paid minus the Rs 100 fee", async () => {
    const s = await seed({ category: "washing", hoursBefore: 2, totalPaise: 100000, paidPaise: 100000 });
    const res = await selfCancel(s.bookingId, await ownerOf(s.bookingId));
    expect(res).toMatchObject({ success: true, manualRefund: true, refundPaise: 90000 });
    expect(await booking(s.bookingId)).toMatchObject({ status: "CANCELLED", manualRefundDuePaise: 90000, cancellationFeePaise: 10000, cancellationFeeStatus: "withheld" });
  });

  it("another customer cannot cancel it, and another tenant cannot either; nothing changes", async () => {
    const s = await seed({ category: "washing", hoursBefore: 10, totalPaise: 100000, paidPaise: 100000 });
    await expect(selfCancel(s.bookingId, uid("other-customer"))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(selfCancel(s.bookingId, await ownerOf(s.bookingId), "other-tenant")).rejects.toMatchObject({ code: "permission-denied" });
    const b = await booking(s.bookingId);
    expect(b["status"]).toBe("CONFIRMED"); expect(b["manualRefundDuePaise"]).toBeUndefined();
    expect(((await db.collection("payments").doc(s.paymentId!).get()).data()!)["status"]).toBe("completed");
  });

  it("a second self-cancel changes nothing (one obligation)", async () => {
    const s = await seed({ category: "washing", hoursBefore: 10, totalPaise: 100000, paidPaise: 100000 });
    const owner = await ownerOf(s.bookingId);
    await selfCancel(s.bookingId, owner);
    expect(await selfCancel(s.bookingId, owner)).toMatchObject({ success: true, alreadyCancelled: true });
    expect(await booking(s.bookingId)).toMatchObject({ manualRefundDuePaise: 100000 });
  });
});
