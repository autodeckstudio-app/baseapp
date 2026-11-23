import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { manualRefundNotice } from "./manual-refund-notice";
describe("manual refund notice", () => {
  it("uses the owed server field, not the booking total", () => {
    expect(manualRefundNotice({ status: "CANCELLED", manualRefundDuePaise: 90000 })).toEqual({ title: "Refund owed by the studio", body: "Return due · ₹900 · Not recorded as returned · Contact studio" });
  });
  it("shows paid minus Rs100 for the late-window fixture", () => {
    const paid = 100000, policyFee = 10000;
    expect(manualRefundNotice({ status: "CANCELLED", manualRefundDuePaise: paid - policyFee })?.body).toContain("₹900 ·");
  });
  it("rejects missing, zero, invalid, unsafe or non-cancelled input", () => {
    for (const v of [undefined, null, 0, -1, NaN, Infinity, 1.5, "90000", Number.MAX_SAFE_INTEGER + 1]) expect(manualRefundNotice({ status: "CANCELLED", manualRefundDuePaise: v })).toBeNull();
    expect(manualRefundNotice({ status: "CONFIRMED", manualRefundDuePaise: 90000 })).toBeNull();
  });
  it("does not add a notice to a provider-only booking; preserves provider wording and Paid row", () => {
    expect(manualRefundNotice({ status: "CANCELLED" })).toBeNull();
    const src = readFileSync(join(__dirname, "../app/(tabs)/bookings/[id].tsx"), "utf8");
    for (const text of ["Refund requested", "Your refund request is recorded.", "The studio has recorded your refund.", "Razorpay reports your refund as processed.", 'title="Payment"']) expect(src).toContain(text);
    expect(src.indexOf("{owedNotice ?")).toBeLessThan(src.indexOf('{!noPaymentDue&&!waitingCancel && !awaitingLinkId && paymentIsCurrent && (!payment || payment.status === "failed" || payment.status === "cancelled") && booking.status === "PENDING"'));
  });
});
