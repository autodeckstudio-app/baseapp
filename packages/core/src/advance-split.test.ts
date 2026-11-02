import { describe, expect, it } from "vitest";
import { advanceSplit, ADVANCE_PERCENT } from "./advance-split.js";

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
