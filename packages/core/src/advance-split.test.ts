import { describe, expect, it } from "vitest";
import { advanceSplit, ADVANCE_PERCENT, NO_SHOW_ADVANCE_DISCLOSURE, NO_SHOW_FULL_ONLINE_DISCLOSURE } from "./advance-split.js";

describe("advanceSplit", () => {
  it("adopted percent is 20", () => {
    expect(ADVANCE_PERCENT).toBe(20);
  });
  it("splits an exact 20/80 and the parts always sum to the base", () => {
    const r = advanceSplit(100000, 0, "service_total_only", "round"); // Rs 1000.00
    expect(r.advancePaise).toBe(20000);
    expect(r.dueAtStudioPaise).toBe(80000);
    expect(r.advancePaise + r.dueAtStudioPaise).toBe(100000);
  });
  it("keeps the pickup basis explicit: plus-pickup includes it, service-only excludes it", () => {
    const withPickup = advanceSplit(100000, 25000, "service_total_plus_pickup", "round");
    expect(withPickup.advancePaise).toBe(25000);
    const serviceOnly = advanceSplit(100000, 25000, "service_total_only", "round");
    expect(serviceOnly.advancePaise).toBe(20000);
    // neither is chosen here - the basis is a held owner decision
  });
  it("ceil rounds UP TO THE NEXT WHOLE RUPEE (owner-adopted 2 Nov), never the next paisa", () => {
    // 20% of Rs 1,768.82 = Rs 353.764 -> Rs 354.00; balance is the exact remainder.
    const frac = advanceSplit(176882, 0, "service_total_only", "ceil");
    expect(frac.advancePaise).toBe(35400);
    expect(frac.dueAtStudioPaise).toBe(141482);
    expect(frac.advancePaise + frac.dueAtStudioPaise).toBe(176882);
    // A fractional-paise raw just over a rupee boundary moves to the next rupee.
    expect(advanceSplit(100001, 0, "service_total_only", "ceil").advancePaise).toBe(20100); // raw 20000.2
    // An already whole-rupee raw is unchanged (rounding up to the next whole
    // rupee when already whole is a no-op).
    expect(advanceSplit(118000, 0, "service_total_only", "ceil").advancePaise).toBe(23600); // raw 23600.0
    // Fractional paise BELOW the next rupee still move up to it.
    expect(advanceSplit(99999, 0, "service_total_only", "ceil").advancePaise).toBe(20000); // raw 19999.8
  });
  it("exposes rounding as a caller decision and keeps the balance an exact remainder under every mode", () => {
    const base = 99999; // 20% = 19999.8 paise
    expect(advanceSplit(base, 0, "service_total_only", "round").advancePaise).toBe(20000);
    expect(advanceSplit(base, 0, "service_total_only", "floor").advancePaise).toBe(19999);
    expect(advanceSplit(base, 0, "service_total_only", "ceil").advancePaise).toBe(20000);
    for (const mode of ["round", "floor", "ceil"] as const) {
      const r = advanceSplit(base, 1234, "service_total_plus_pickup", mode);
      expect(r.advancePaise + r.dueAtStudioPaise).toBe(base + 1234);
    }
  });
  it("rejects non-integer or negative inputs", () => {
    expect(() => advanceSplit(-1, 0, "service_total_only", "round")).toThrow();
    expect(() => advanceSplit(100.5, 0, "service_total_only", "round")).toThrow();
  });
});

describe("no-show disclosures (item 5, OWNER-APPROVED 2 Nov 21:32:50)", () => {
  it("pay-at-studio advance line", () => {
    expect(NO_SHOW_ADVANCE_DISCLOSURE).toContain("20% advance");
    expect(NO_SHOW_ADVANCE_DISCLOSURE).toContain("Nothing more is charged");
    expect(NO_SHOW_ADVANCE_DISCLOSURE.toLowerCase()).not.toContain("cancel");
  });
  it("full-online line: 20% of service kept, remainder to owner refund approval, never auto-refunded", () => {
    expect(NO_SHOW_FULL_ONLINE_DISCLOSURE).toContain("20% of the discounted service price including GST");
    expect(NO_SHOW_FULL_ONLINE_DISCLOSURE).toContain("unused pickup and drop charges and their GST");
    expect(NO_SHOW_FULL_ONLINE_DISCLOSURE).toContain("refund approval");
    expect(NO_SHOW_FULL_ONLINE_DISCLOSURE.toLowerCase()).not.toContain("cancel");
  });
});
