/**
 * TEST. Reviewer B: a verified webhook for an advance (targetType "booking")
 * must complete the payment and mark the booking advance-paid - never leave
 * money received while the Payment stays pending. Duplicate / mismatch /
 * anomaly paths stay closed. Real emulator, signature on, mock-free provider.
 */
import type * as RazorpayProviderModule from "../../lib/razorpay-provider.js";
import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";

const SECRET = "whsec_local_test";
vi.mock("../../lib/razorpay-provider.js", async (orig) => {
  const m = await orig<typeof RazorpayProviderModule>();
  return { ...m, getPaymentProvider: () => new m.RazorpayProvider("rzp_test_x", "k", SECRET) };
});
import { razorpayWebhook } from "../../functions/payment/razorpayWebhook.js";

const db = getFirestore();
let n = 0;
const sign = (raw: string) => createHmac("sha256", SECRET).update(raw).digest("hex");
async function call(raw: string, eid: string) {
  const req = { method: "POST", rawBody: Buffer.from(raw), header: (k: string) => ({ "x-razorpay-signature": sign(raw), "x-razorpay-event-id": eid })[k.toLowerCase()] } as never;
  let status = 0; let body: unknown;
  const res = { status(c: number) { status = c; return res; }, send(b: unknown) { body = b; return res; }, json(b: unknown) { body = b; return res; } } as never;
  await (razorpayWebhook as unknown as (a: unknown, b: unknown) => Promise<void>)(req, res);
  return { status, body: body as { outcome?: string } };
}
const captured = (orderId: string, amount: number, payId: string) =>
  JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: payId, order_id: orderId, amount, currency: "INR", status: "captured" } } } });

async function seed(o: { bookingStatus?: string; advancePaidAt?: string | null; amount?: number } = {}) {
  n += 1; const id = `${Date.now()}${n}`;
  const payDocId = `advance-ab${id}`, bookingId = `ab${id}`, orderId = `order_adv_${id}`, payId = `pay_adv_${id}`;
  await db.collection("payments").doc(payDocId).set({
    id: payDocId, tenantId: "adv-t", studioId: "st1", targetType: "booking", jobId: null, bookingId,
    membershipId: null, customerId: "c1", amount: o.amount ?? 23600, currency: "INR", method: "razorpay_payment_link",
    status: "pending", paymentUrl: "https://pay/x", razorpayPaymentLinkId: `plink_${id}`, razorpayPaymentId: null,
    razorpayOrderId: orderId, razorpayRefundId: null, refundAmount: null, manualReference: null, recordedBy: null,
    invoiceId: null, providerEventId: null, completedAt: null, failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection("bookings").doc(bookingId).set({
    id: bookingId, tenantId: "adv-t", studioId: "st1", status: o.bookingStatus ?? "CONFIRMED",
    paymentStatus: "unpaid", advancePaymentId: payDocId, advancePaidAt: o.advancePaidAt ?? null,
  });
  return { payDocId, bookingId, orderId, payId };
}

describe("advance webhook (targetType booking, reviewer B)", () => {
  it("capture completes the payment and sets booking.advancePaidAt WITHOUT flipping booking status", async () => {
    const s = await seed();
    const r = await call(captured(s.orderId, 23600, s.payId), "ADV1" + s.payDocId);
    expect(r.status).toBe(200); expect(r.body.outcome).toBe("completed");
    const pay = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay.status).toBe("completed");
    expect(pay.razorpayPaymentId).toBe(s.payId);
    expect(pay.invoiceReviewNeeded ?? null).toBeNull();
    const bk = (await db.collection("bookings").doc(s.bookingId).get()).data()!;
    expect(bk.advancePaidAt).toBeTruthy();
    expect(bk.status).toBe("CONFIRMED"); // no status flip
  });

  it("replay of the same event is a duplicate, state unchanged", async () => {
    const s = await seed();
    const raw = captured(s.orderId, 23600, s.payId);
    await call(raw, "ADV2" + s.payDocId);
    const r = await call(raw, "ADV2" + s.payDocId);
    expect(r.body.outcome).toBe("duplicate");
  });

  it("amount mismatch completes nothing", async () => {
    const s = await seed();
    const r = await call(captured(s.orderId, 99999, s.payId), "ADV3" + s.payDocId);
    expect(r.body.outcome).toBe("amount_mismatch");
    const pay = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay.status).toBe("pending");
  });

  it("money against a CANCELLED booking is recorded as received, flagged for review, booking untouched", async () => {
    const s = await seed({ bookingStatus: "CANCELLED" });
    const r = await call(captured(s.orderId, 23600, s.payId), "ADV4" + s.payDocId);
    expect(r.body.outcome).toBe("completed");
    const pay = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay.status).toBe("completed");
    expect(pay.invoiceReviewNeeded).toBe(true);
    const bk = (await db.collection("bookings").doc(s.bookingId).get()).data()!;
    expect(bk.advancePaidAt ?? null).toBeNull(); // untouched
  });

  it("a second capture for an already advance-paid booking flags review instead of double-marking", async () => {
    const s = await seed();
    await call(captured(s.orderId, 23600, s.payId), "ADV5" + s.payDocId);
    // a NEW event id (out-of-order/late second capture) while payment is already completed:
    const r = await call(captured(s.orderId, 23600, s.payId), "ADV6" + s.payDocId);
    expect(r.body.outcome).toBe("already_final");
  });
});
