// Track A2 source guards: the duplicate-refund closures stay in place and in order.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const initiate = readFileSync(`${__dirname}/../../functions/payment/initiateRefund.ts`, "utf8");
const webhook = readFileSync(`${__dirname}/../../lib/razorpay-webhook.ts`, "utf8");

describe("duplicate-refund closures", () => {
  it("initiateRefund refuses booking-linked payments BEFORE claiming the refund event", () => {
    const guard = initiate.indexOf("Booking payments are refunded through the booking refund review flow");
    const claim = initiate.indexOf("refund_${data.paymentId}");
    expect(guard).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(claim);
  });
  it("initiateRefund refuses payments with an active outbox reservation", () => {
    expect(initiate).toContain("activeReservation");
    expect(initiate).toContain("A refund request is already active for this payment.");
  });
  it("webhook treats partially_refunded as final for capture events", () => {
    const guard = webhook.indexOf('payment.status === "partially_refunded"');
    expect(guard).toBeGreaterThan(-1);
    expect(webhook).toContain("a late capture event must never reactivate");
  });
  it("webhook validates reserved refunds and records acceptance before any projection", () => {
    const reservation = webhook.indexOf("activeReservation(db, payment.id)");
    const accepted = webhook.indexOf('record("refund_accepted")');
    const legacy = webhook.indexOf("Unreserved external refund");
    expect(reservation).toBeGreaterThan(-1);
    expect(accepted).toBeGreaterThan(reservation);
    expect(legacy).toBeGreaterThan(accepted);
  });
});

describe("no-show review cannot enact held semantics", () => {
  const noShow = readFileSync(`${__dirname}/../../functions/booking/noShowReview.ts`, "utf8");
  it("money moves only through reserveRefund — no direct provider or payment writes", () => {
    expect(noShow).toContain("reserveRefund");
    expect(noShow).not.toContain("initiateRefund(");
    expect(noShow).not.toContain("getPaymentProvider");
  });
  it("no waiver auto-grant, shortfall, benefit or post-arrival logic", () => {
    expect(noShow).not.toMatch(/shortfall/i);
    expect(noShow).not.toContain("VEHICLE_RECEIVED");
    expect(noShow).not.toContain("pickupBenefit");
    // waiver exists only as an explicit admin resolution value, never defaulted
    expect(noShow).not.toContain('resolution = "waive"');
  });
  it("reopen stays held", () => {
    expect(noShow).toContain("Reopen is held");
  });
});
