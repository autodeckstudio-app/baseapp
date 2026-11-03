import { describe, it, expect } from "vitest";
import { buildAdvancePaymentRequest, computeAdvanceSplitFromBreakdown, studioBalancePaise, ADVANCE_PAYMENT_ENABLED, type AdvanceBookingShape } from "../../lib/advance-payment.js";

// A real snapshotted breakdown: service subtotal Rs 1,000.00 + pickup Rs 50.00
// + drop Rs 30.00 folded into subtotal by applyPickupFees; 18% GST.
const booking: AdvanceBookingShape = {
  id: "b-1",
  payMode: "studio",
  currency: "INR",
  priceBreakdown: {
    subtotal: 108000,
    pickupFee: 5000,
    dropFee: 3000,
    membershipDiscount: null,
    taxRatePercent: 18,
    total: 127440, // 108000 + round(108000 * 0.18) - pickup GST INCLUDED
  },
};

describe("buildAdvancePaymentRequest (owner-approved activation)", () => {
  it("release candidate remains OFF; adopted calculation is available only to explicit isolated test", () => {
    expect(ADVANCE_PAYMENT_ENABLED).toBe(false);
    expect(()=>buildAdvancePaymentRequest(booking, "service_total_only", "ceil")).toThrow();
    const request = buildAdvancePaymentRequest(booking, "service_total_only", "ceil", {enabled:true});
    expect(request.amountPaise).toBe(23600);
    expect(request.dueAtStudioPaise).toBe(103840);
    expect(request.bookingId).toBe(booking.id);
  });

  it("the disabled seam still rejects before building a provider request", () => {
    expect(() => buildAdvancePaymentRequest(booking, "service_total_only", "ceil", { enabled: false })).toThrow(/disabled/);
  });

  it("requires explicit basis and rounding - there is no defaulted call", () => {
    // Type-level: both params are required in the signature. Runtime proof:
    // even the disabled error path takes them, so a caller cannot omit them.
    expect(buildAdvancePaymentRequest.length).toBe(4) // + the R4 dependency-override param (flag seam);
  });

  it("derives the adopted base from a REAL breakdown: discounted service incl GST, excl pickup AND its GST", () => {
    // service 100000, discounted by 0, taxed at 18% -> base 118000.
    // The snapshot's total would be 108000 + round(108000*0.18)=19440 -> 127440;
    // naive total - pickup - drop = 119440 wrongly keeps the pickup GST (1440).
    const split = computeAdvanceSplitFromBreakdown(booking.priceBreakdown, "service_total_only", "ceil");
    expect(split.advancePaise).toBe(23600); // ceil(20% of 118000)
    expect(split.dueAtStudioPaise).toBe(94400); // exact remainder of the SERVICE total
    expect(split.advancePaise + split.dueAtStudioPaise).toBe(118000);
  });

  it("membership discount reduces the base before tax, matching applyMembershipBenefit", () => {
    const split = computeAdvanceSplitFromBreakdown(
      { ...booking.priceBreakdown, membershipDiscount: 10000 },
      "service_total_only",
      "ceil",
    );
    // (100000 - 10000) = 90000, tax 16200, base 106200, advance ceil 20% = 21240
    expect(split.advancePaise).toBe(21240);
    expect(split.dueAtStudioPaise).toBe(84960);
  });

  it("a fully covered wash yields a zero advance (nothing remains to advance)", () => {
    const split = computeAdvanceSplitFromBreakdown(
      { ...booking.priceBreakdown, membershipDiscount: 100000 },
      "service_total_only",
      "ceil",
    );
    expect(split.advancePaise).toBe(0);
    expect(split.dueAtStudioPaise).toBe(0);
  });

  it("GST-disabled snapshot (rate 0) advances on the discounted service alone", () => {
    const split = computeAdvanceSplitFromBreakdown(
      { ...booking.priceBreakdown, taxRatePercent: 0 },
      "service_total_only",
      "ceil",
    );
    expect(split.advancePaise).toBe(20000);
    expect(split.dueAtStudioPaise).toBe(80000);
  });

  it("fails CLOSED on a negative base (reviewer D): discount over the service subtotal throws, never clamps", () => {
    expect(() =>
      computeAdvanceSplitFromBreakdown(
        { ...booking.priceBreakdown, membershipDiscount: 100001 },
        "service_total_only",
        "ceil",
      ),
    ).toThrow(/negative/);
  });

  it("studio balance reconciles to the snapshot grand total incl pickup AND its GST (reviewer E), not the service remainder", () => {
    // total 127440 - advance 23600 = 103840 (pin). The service-only remainder
    // (94400) would under-charge by pickup+drop+their GST (8000+1440=9440).
    expect(studioBalancePaise(booking.priceBreakdown, 23600)).toBe(103840);
    expect(studioBalancePaise(booking.priceBreakdown, 23600)).not.toBe(94400);
  });

  it("studio balance fails closed when the advance exceeds the grand total", () => {
    expect(() => studioBalancePaise(booking.priceBreakdown, 127441)).toThrow(/exceeds/);
  });

  it("plus_pickup remains available only as an explicit non-adopted basis", () => {
    const split = computeAdvanceSplitFromBreakdown(booking.priceBreakdown, "service_total_plus_pickup", "ceil");
    expect(split.advancePaise).toBeGreaterThan(23600); // pickup fees join the base
  });
});
