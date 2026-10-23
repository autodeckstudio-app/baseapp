import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { cancellationTerms, cancellationLine, isBiggerService, CANCEL_SHORT, CANCEL_BIGGER, PAY_AT_STUDIO_GROUPS } from "@autodeck/core";

const H = 3_600_000;
const at = (category: string, hoursBefore: number, total = 500_000) => cancellationTerms({ category, totalPaise: total, scheduledAtMs: 1_000 * H + hoursBefore * H, nowMs: 1_000 * H });

describe("cancellation policy", () => {
  it("constants", () => { expect(CANCEL_SHORT).toEqual({ freeUntilHours: 4, feePaise: 10000 }); expect(CANCEL_BIGGER).toEqual({ freeUntilHours: 24, feePercent: 20 }); });
  it("short jobs: free to 4 h before, Rs 100 inside", () => {
    expect(at("washing", 5)).toMatchObject({ free: true, feePaise: 0, bigger: false });
    expect(at("washing", 4)).toMatchObject({ free: true, feePaise: 0 });
    expect(at("washing", 3.9)).toMatchObject({ free: false, feePaise: 10000 });
  });
  it("bigger services: free to 24 h before, 20% of the total inside", () => {
    expect(at("ceramic", 25)).toMatchObject({ free: true, feePaise: 0, bigger: true });
    expect(at("ceramic", 23, 500_000)).toMatchObject({ free: false, feePaise: 100_000 });
    expect(at("ceramic", 1, 12_345)).toMatchObject({ feePaise: Math.round(12_345 * 0.2) });
  });
  it("the bigger list is the pay-at-studio list, one config", () => {
    expect(PAY_AT_STUDIO_GROUPS.length).toBeGreaterThan(0);
    expect(isBiggerService(undefined)).toBe(false);
  });
  it("the customer line comes from the same numbers", () => {
    expect(cancellationLine("washing")).toContain("4 hours"); expect(cancellationLine("washing")).toContain("Rs 100");
    expect(cancellationLine("ceramic")).toContain("24 hours"); expect(cancellationLine("ceramic")).toContain("20%");
  });
  it("round 5: customer cancel uses the shared path with a real refund, later days only, same fee policy", () => {
    const src = readFileSync(`${__dirname}/../../functions/booking/cancelBooking.ts`, "utf8");
    const run = readFileSync(`${__dirname}/../../functions/booking/adminCancelBooking.ts`, "utf8");
    expect(src).toContain('runCancel(user, { bookingId: data.bookingId, reason: data.reason, feeAction: "charge" }, "customer")');
    expect(src).toContain("RAZORPAY_KEY_SECRET");
    expect(run).toContain("cancellationTerms(");
    expect(run).not.toContain("isCancellableDay"); expect(run).not.toContain("until the day before");
    expect(run).toContain("getPaymentProvider().initiateRefund");
    expect(run).toContain("refund_${paymentRef.id}");
    expect(run).toContain("The refund did not go through, so the booking is NOT cancelled");
    expect(src).toContain("Work on your car has already started");
  });
  it("the Terms page states the same numbers as the config", () => {
    const terms = readFileSync(`${__dirname}/../../../../apps/site/src/pages/terms.astro`, "utf8");
    expect(terms).toContain(`${CANCEL_SHORT.freeUntilHours} hours before the start; after that, Rs ${CANCEL_SHORT.feePaise / 100}`);
    expect(terms).toContain(`${CANCEL_BIGGER.freeUntilHours} hours before the start; after that, ${CANCEL_BIGGER.feePercent}%`);
    expect(terms).not.toContain("working days");
    expect(terms).not.toContain("\u2014");
  });
});
