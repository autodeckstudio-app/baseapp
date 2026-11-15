/* eslint-disable @typescript-eslint/no-explicit-any */
// Advance (pay-at-studio) webhook callback tests: real processProviderEvent
// code + fakeFirestore, SYNTHETIC events parsed by the real provider parser.
// Synthetic signed/mapped events only - this is NOT actual Razorpay delivery
// (the deployed endpoint stays live-keyed and untouched).
import { describe, it, expect, vi } from "vitest";

const audits: Array<{ action: string }> = [];
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: (_tx: unknown, p: { action: string }) => { audits.push(p); } }));

import { RazorpayProvider } from "../../lib/razorpay-provider.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { fakeFirestore } from "./fake-firestore.js";

const provider = new RazorpayProvider("rzp_test_x", "secret", "whsec_test");

// Owner-adopted split fixture (2 Nov policy): service subtotal 100000 + pickup
// 5000 + drop 3000 folded into subtotal 108000; GST 18%; total 127440.
// Advance = 20% of the SERVICE base incl GST excl pickup (118000) = 23600.
const ADVANCE = 23600;
const FUTURE = new Date(Date.now() + 10 * 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

function seed(over: Record<string, unknown> = {}) {
  return {
    bookings: {
      b1: {
        id: "b1", tenantId: "t", studioId: "s", customerId: "c1",
        status: "PENDING", paymentStatus: "unpaid", payMode: "studio",
        holdExpiresAt: FUTURE, advancePaidAt: null,
        priceBreakdown: { subtotal: 108000, pickupFee: 5000, dropFee: 3000, membershipDiscount: null, taxRatePercent: 18, total: 127440 },
      },
    },
    payments: {
      "advance-b1": {
        id: "advance-b1", tenantId: "t", studioId: "s", targetType: "booking",
        jobId: null, bookingId: "b1", membershipId: null, customerId: "c1",
        amount: ADVANCE, currency: "INR", method: "razorpay_payment_link",
        status: "pending", paymentUrl: "https://rzp.io/l/adv1",
        razorpayPaymentLinkId: "plink_adv1", razorpayPaymentId: null,
        razorpayOrderId: "order_adv1", invoiceId: null,
      },
    },
    ...over,
  } as never;
}

const paid = (id: string, payEntity: Record<string, unknown> = {}, linkEntity: Record<string, unknown> = {}) =>
  JSON.stringify({
    entity: "event", event: "payment_link.paid",
    payload: {
      payment: { entity: { id: "pay_adv1", order_id: "order_adv1", amount: ADVANCE, currency: "INR", ...payEntity } },
      payment_link: { entity: { id: "plink_adv1", reference_id: "advance-b1", amount: ADVANCE, ...linkEntity } },
    },
    _id: id,
  });

const expired = (id: string) =>
  JSON.stringify({
    entity: "event", event: "payment_link.expired",
    payload: { payment_link: { entity: { id: "plink_adv1", reference_id: "advance-b1", amount: ADVANCE } } },
    _id: id,
  });

function ev(raw: string, id: string) {
  const e = provider.parseWebhookEvent(raw);
  e.providerEventId = id;
  return e;
}

const readback = (data: any, coll: string, id: string) => data[coll]?.[id];

describe("advance webhook (synthetic events, real handler code)", () => {
  it("payment_link.paid on an active held booking completes the advance and confirms the booking in one transition", async () => {
    const { db, data } = fakeFirestore(seed());
    const r = await processProviderEvent(db as never, ev(paid("evt-a1"), "evt-a1"));
    expect(r).toEqual({ outcome: "completed", paymentId: "advance-b1" });
    const payment = readback(data, "payments", "advance-b1");
    expect(payment.status).toBe("completed");
    expect(payment.amount).toBe(ADVANCE); // amount untouched by the callback
    expect(payment.razorpayPaymentId).toBe("pay_adv1");
    expect(payment.providerEventId).toBe("evt-a1");
    expect(payment.completedAt).toBeTruthy();
    const booking = readback(data, "bookings", "b1");
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.advancePaidAt).toBe(booking.confirmedAt);
    expect(booking.holdExpiresAt).toBeNull();
    expect(audits.map((a) => a.action)).toContain("booking.confirmed");
  });

  it("the same advance event delivered twice changes nothing the second time", async () => {
    const { db, data } = fakeFirestore(seed());
    await processProviderEvent(db as never, ev(paid("evt-dup"), "evt-dup"));
    const first = { ...readback(data, "bookings", "b1") };
    const r2 = await processProviderEvent(db as never, ev(paid("evt-dup"), "evt-dup"));
    expect(r2.outcome).toBe("duplicate");
    const second = readback(data, "bookings", "b1");
    expect(second.confirmedAt).toBe(first.confirmedAt);
    expect(second.advancePaidAt).toBe(first.advancePaidAt);
  });

  it("an advance capture with a missing provider currency fails closed", async () => {
    const { db, data } = fakeFirestore(seed());
    // currency deliberately absent from the payment entity
    const parsed = JSON.parse(paid("evt-cur"));
    delete parsed.payload.payment.entity.currency;
    const r = await processProviderEvent(db as never, ev(JSON.stringify(parsed), "evt-cur"));
    expect(r.outcome).toBe("amount_mismatch");
    expect(readback(data, "payments", "advance-b1").status).toBe("pending");
    expect(readback(data, "bookings", "b1").status).toBe("PENDING");
  });

  it("money on a SUPERSEDED link completes the payment but never confirms the booking, flags review, and cancels the current link", async () => {
    const { db, data } = fakeFirestore(seed());
    const cancels: string[] = [];
    const r = await processProviderEvent(
      db as never,
      ev(paid("evt-old", { order_id: "order_old" }, { id: "plink_old" }), "evt-old"),
      { cancelLink: async (id: string) => { cancels.push(id); return { outcome: "cancelled" } as never; } },
    );
    expect(r.outcome).toBe("old_link_capture");
    const payment = readback(data, "payments", "advance-b1");
    expect(payment.status).toBe("completed"); // money IS recorded as received
    expect(payment.invoiceReviewNeeded).toBe(true);
    expect(readback(data, "bookings", "b1").status).toBe("PENDING"); // no confirmation on a stale ref
    expect(cancels).toEqual(["plink_adv1"]); // current payable link cancelled so it cannot ALSO be paid
  });

  it("money landing after the hold expired is recorded but the booking is NOT confirmed", async () => {
    const { db, data } = fakeFirestore(seed());
    (data as any).bookings.b1.holdExpiresAt = PAST;
    const r = await processProviderEvent(db as never, ev(paid("evt-exp"), "evt-exp"));
    expect(r.outcome).toBe("completed");
    expect(readback(data, "payments", "advance-b1").status).toBe("completed");
    expect(readback(data, "payments", "advance-b1").invoiceReviewNeeded).toBe(true);
    expect(readback(data, "bookings", "b1").status).toBe("PENDING");
  });

  it("payment_link.expired clears the dead advance URL but keeps the link id for reconciliation", async () => {
    const { db, data } = fakeFirestore(seed());
    const r = await processProviderEvent(db as never, ev(expired("evt-lx"), "evt-lx"));
    expect(r.outcome).toBe("link_expired");
    const payment = readback(data, "payments", "advance-b1");
    expect(payment.paymentUrl).toBeNull();
    expect(payment.razorpayPaymentLinkId).toBe("plink_adv1"); // kept for provider reconciliation
    expect(payment.status).toBe("pending"); // no money moved
    expect(readback(data, "bookings", "b1").status).toBe("PENDING");
  });
});
