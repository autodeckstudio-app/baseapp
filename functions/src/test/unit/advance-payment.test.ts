import { describe, it, expect } from "vitest";
import { buildAdvancePaymentRequest, ADVANCE_PAYMENT_ENABLED, type AdvanceBookingShape } from "../../lib/advance-payment.js";

const booking: AdvanceBookingShape = {
  id: "b-1",
  payMode: "studio",
  currency: "INR",
  priceBreakdown: { total: 100000 }, // Rs 1,000.00 in paise
  pickupTotalPaise: 5000,
};

describe("buildAdvancePaymentRequest (preview, disabled)", () => {
  it("is disabled: ADVANCE_PAYMENT_ENABLED is false and every call throws before any provider shape is built", () => {
    expect(ADVANCE_PAYMENT_ENABLED).toBe(false);
    expect(() => buildAdvancePaymentRequest(booking, "service_total_only", "ceil")).toThrow(/disabled/);
  });

  it("requires explicit basis and rounding - there is no defaulted call", () => {
    // Type-level: both params are required in the signature. Runtime proof:
    // even the disabled error path takes them, so a caller cannot omit them.
    expect(buildAdvancePaymentRequest.length).toBe(3);
  });

  it("core split math stays exact for the provisional recommendation (service total incl. tax, excl. pickup, ceil)", async () => {
    const { advanceSplit } = await import("@autodeck/core");
    const split = advanceSplit(100000, 5000, "service_total_only", "ceil");
    expect(split.advancePaise).toBe(20000); // exactly 20% of the service total
    expect(split.dueAtStudioPaise).toBe(80000); // exact remainder, pickup untouched
    expect(split.advancePaise + split.dueAtStudioPaise).toBe(100000);
  });

  it("core split includes pickup only under the explicit plus_pickup basis", async () => {
    const { advanceSplit } = await import("@autodeck/core");
    const split = advanceSplit(100000, 5000, "service_total_plus_pickup", "ceil");
    expect(split.advancePaise).toBe(21000);
    expect(split.dueAtStudioPaise).toBe(84000);
  });
});
