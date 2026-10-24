import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Source guard: booking.refundStatus "initiated" means the provider accepted a refund.
// adminCancelBooking may write it only when a provider refund id exists.
describe("adminCancelBooking refundStatus provenance", () => {
  const src = readFileSync(join(__dirname, "../../functions/booking/adminCancelBooking.ts"), "utf8");
  it("writes initiated only together with a provider refund id", () => {
    expect(src).toMatch(/providerRefundId \? \{ refundStatus: "initiated" as const, refundId: providerRefundId \}/);
    expect(src).not.toMatch(/paymentStatus: "refunded", refundStatus: "initiated", refundId: providerRefundId \}/);
  });
});
