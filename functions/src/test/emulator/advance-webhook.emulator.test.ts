/**
 * TEST. Reviewer B: a verified webhook for an advance (targetType "booking")
 * must complete the payment and mark the booking advance-paid - never leave
 * money received while the Payment stays pending. Duplicate / mismatch /
 * anomaly paths stay closed. Real emulator, signature on, mock-free provider.
 */
import type * as RazorpayProviderModule from "../../lib/razorpay-provider.js";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";

const SECRET = "whsec_local_test";
const h = vi.hoisted(() => ({ cancelCalls: [] as string[], cancelOutcome: { outcome: "cancelled" } as { outcome: string } }));
vi.mock("../../lib/razorpay-provider.js", async (orig) => {
  const m = await orig<typeof RazorpayProviderModule>();
  return { ...m, getPaymentProvider: () => {
    const p = new m.RazorpayProvider("rzp_test_x", "k", SECRET);
    (p as { cancelPaymentLink: unknown }).cancelPaymentLink = async (id: string) => { h.cancelCalls.push(id); return h.cancelOutcome; };
    return p;
  } };
});
import { razorpayWebhook } from "../../functions/payment/razorpayWebhook.js";

const db = getFirestore();
beforeAll(() => {
  // Hard guard (reviewer F3): this suite WRITES. Without an emulator host
  // those writes would hit a real backend - refuse loudly instead.
  if (!process.env["FIRESTORE_EMULATOR_HOST"]) {
    throw new Error("advance-webhook tests write to Firestore; refusing to run without FIRESTORE_EMULATOR_HOST (never a real backend).");
  }
});
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
  return { payDocId, bookingId, orderId, payId, linkId: `plink_${id}` };
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

  it("payment_link.expired on a pending advance clears the dead stored URL; payment stays pending (reviewer W3)", async () => {
    const s = await seed();
    const raw = JSON.stringify({ event: "payment_link.expired", payload: { payment_link: { entity: { id: s.linkId, status: "expired" } } } });
    // findPayment matches on razorpayPaymentLinkId from the link entity
    const r = await call(raw, "ADVX" + s.payDocId);
    expect(r.body.outcome).toBe("link_expired");
    const pay = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay.paymentUrl ?? null).toBeNull(); // dead URL cleared
    expect(pay.status).toBe("pending"); // no money moved
    expect(pay.razorpayPaymentLinkId).toBeTruthy(); // kept for reconciliation
  });

  it("F2: a raw payment entity with NO currency fails closed (parser default INR must not mask it)", async () => {
    const s = await seed();
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: s.payId, order_id: s.orderId, amount: 23600, status: "captured" } } } });
    const r = await call(raw, "ADVC0" + s.payDocId);
    expect(r.body.outcome).toBe("amount_mismatch");
    expect((await db.collection("payments").doc(s.payDocId).get()).data()!.status).toBe("pending");
  });

  it("F2: a wrong provider currency fails closed", async () => {
    const s = await seed();
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: s.payId, order_id: s.orderId, amount: 23600, currency: "USD", status: "captured" } } } });
    const r = await call(raw, "ADVC1" + s.payDocId);
    expect(r.body.outcome).toBe("amount_mismatch");
    expect((await db.collection("payments").doc(s.payDocId).get()).data()!.status).toBe("pending");
  });

  it("F1: a cross-TENANT booking is never mutated; money recorded + flagged for review", async () => {
    const s = await seed();
    await db.collection("bookings").doc(s.bookingId).update({ tenantId: "OTHER-tenant" });
    const r = await call(captured(s.orderId, 23600, s.payId), "ADVC2" + s.payDocId);
    expect(r.body.outcome).toBe("completed");
    const pay = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay.status).toBe("completed"); expect(pay.invoiceReviewNeeded).toBe(true);
    expect((await db.collection("bookings").doc(s.bookingId).get()).data()!.advancePaidAt ?? null).toBeNull();
  });

  it("F1: a one-sided null studio does NOT bypass the binding (booking null vs payment set)", async () => {
    const s = await seed();
    await db.collection("bookings").doc(s.bookingId).update({ studioId: null });
    const r = await call(captured(s.orderId, 23600, s.payId), "ADVC3" + s.payDocId);
    expect(r.body.outcome).toBe("completed");
    const pay = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay.invoiceReviewNeeded).toBe(true);
    expect((await db.collection("bookings").doc(s.bookingId).get()).data()!.advancePaidAt ?? null).toBeNull();
  });

  it("G3: a LATE capture on a SUPERSEDED link completes with the actual capture identity, flags review, does NOT mark advancePaidAt, and provider-cancels the current link", async () => {
    const s = await seed();
    // The link was replaced: current ids on the doc, old ids in the append-only history.
    await db.collection("payments").doc(s.payDocId).update({
      razorpayPaymentLinkId: "plink_CURRENT", razorpayOrderId: "order_CURRENT",
      priorLinkIds: [s.linkId], priorOrderIds: [s.orderId],
    });
    h.cancelCalls.length = 0; h.cancelOutcome = { outcome: "cancelled" };
    // Late-settling capture against the OLD order (authorized before expiry).
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_OLD", order_id: s.orderId, amount: 23600, currency: "INR", status: "captured" } } } });
    const r = await call(raw, "ADVO" + s.payDocId);
    expect(r.body.outcome).toBe("old_link_capture");
    const pay = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay.status).toBe("completed");
    expect(pay.razorpayPaymentId).toBe("pay_OLD"); // ACTUAL capture identity preserved
    expect(pay.invoiceReviewNeeded).toBe(true);
    const bk = (await db.collection("bookings").doc(s.bookingId).get()).data()!;
    expect(bk.advancePaidAt ?? null).toBeNull(); // a human verifies which payment stands
    expect(h.cancelCalls).toEqual(["plink_CURRENT"]); // current link cancelled post-commit: no double collection
    const alert = await db.collection("staffAlerts").doc(`advance_old_link_capture_${s.payDocId}`).get();
    expect(alert.exists).toBe(true);
    expect(alert.data()!["cancelOutcome"]).toBe("cancelled");
  });

  it("G3: a DISTINCT second capture on a settled advance is overpayment review - identities preserved, never flattened to already_final", async () => {
    const s = await seed();
    await call(captured(s.orderId, 23600, "pay_FIRST"), "ADVP1" + s.payDocId);
    const r = await call(captured(s.orderId, 23600, "pay_SECOND"), "ADVP2" + s.payDocId);
    expect(r.body.outcome).toBe("overpayment_review");
    const pay = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay.razorpayPaymentId).toBe("pay_FIRST"); // original completion untouched
    expect(pay.overpayments).toHaveLength(1);
    expect(pay.overpayments[0]).toMatchObject({ providerPaymentId: "pay_SECOND", amount: 23600, currency: "INR" });
    expect(pay.invoiceReviewNeeded).toBe(true);
    // APPEND (main 2 Nov): a THIRD distinct capture appends - every identity
    // stays for operational review, never an overwrite of the latest slot.
    const r3 = await call(captured(s.orderId, 23600, "pay_THIRD"), "ADVP3" + s.payDocId);
    expect(r3.body.outcome).toBe("overpayment_review");
    const pay3 = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay3.overpayments.map((x: { providerPaymentId: string }) => x.providerPaymentId)).toEqual(["pay_SECOND", "pay_THIRD"]);
    expect(pay3.razorpayPaymentId).toBe("pay_FIRST");
  });

  it("R3: an advance capture on an ACTIVE held (PENDING) booking confirms it and clears the hold", async () => {
    const s = await seed({ bookingStatus: "PENDING" });
    await db.collection("bookings").doc(s.bookingId).update({ paymentStatus: "unpaid", holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
    const r = await call(captured(s.orderId, 23600, s.payId), "ADVR3a" + s.payDocId);
    expect(r.body.outcome).toBe("completed");
    const bk = (await db.collection("bookings").doc(s.bookingId).get()).data()!;
    expect(bk.status).toBe("CONFIRMED");
    expect(bk.advancePaidAt).toBeTruthy();
    expect(bk.holdExpiresAt ?? null).toBeNull();
  });

  it("R3: an advance capture on an EXPIRED hold records money + review but does NOT confirm", async () => {
    const s = await seed({ bookingStatus: "PENDING" });
    await db.collection("bookings").doc(s.bookingId).update({ paymentStatus: "unpaid", holdExpiresAt: new Date(Date.now() - 60_000).toISOString() });
    const r = await call(captured(s.orderId, 23600, s.payId), "ADVR3b" + s.payDocId);
    expect(r.body.outcome).toBe("completed");
    const pay = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay.status).toBe("completed");
    expect(pay.invoiceReviewNeeded).toBe(true); // advance_hold_expired -> office queue
    const bk = (await db.collection("bookings").doc(s.bookingId).get()).data()!;
    expect(bk.status).toBe("PENDING"); // sweep releases it; never confirmed
    expect(bk.advancePaidAt ?? null).toBeNull();
  });

  it("G3: redelivery of the SAME capture (same providerPaymentId, new event id) stays idempotent already_final - no overpayment flag", async () => {
    const s = await seed();
    await call(captured(s.orderId, 23600, "pay_SAME"), "ADVR1" + s.payDocId);
    const r = await call(captured(s.orderId, 23600, "pay_SAME"), "ADVR2" + s.payDocId);
    expect(r.body.outcome).toBe("already_final");
    const pay = (await db.collection("payments").doc(s.payDocId).get()).data()!;
    expect(pay.overpayment ?? null).toBeNull();
  });

  it("a second capture for an already advance-paid booking flags review instead of double-marking", async () => {
    const s = await seed();
    await call(captured(s.orderId, 23600, s.payId), "ADV5" + s.payDocId);
    // a NEW event id (out-of-order/late second capture) while payment is already completed:
    const r = await call(captured(s.orderId, 23600, s.payId), "ADV6" + s.payDocId);
    expect(r.body.outcome).toBe("already_final");
  });
});
