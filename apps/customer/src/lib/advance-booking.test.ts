import { describe, expect, it } from "vitest";
import { ADVANCE_SPLIT_ENABLED, advanceDisclosureLines } from "./advance-booking";

describe("advance split disclosure (items 4/5, preview)", () => {
  it("is DISABLED until the held basis/rounding decisions, payment wiring and final gate", () => {
    expect(ADVANCE_SPLIT_ENABLED).toBe(false);
  });
  it("copy states the adopted 20% split without computing an amount (basis/rounding held)", () => {
    const { split } = advanceDisclosureLines();
    expect(split).toContain("20%");
    expect(split).not.toMatch(/₹|rs\.?|paise/i);
  });
  it("no-show disclosure comes before payment and avoids cancellation wording", () => {
    const { noShow } = advanceDisclosureLines();
    expect(noShow).toContain("20%");
    expect(noShow.toLowerCase()).not.toContain("cancel");
  });
});
