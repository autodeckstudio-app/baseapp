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
  it("no-show line matches the owner-approved rule (2 Nov 21:32:50) and avoids cancellation wording", () => {
    const { noShow } = advanceDisclosureLines();
    expect(noShow).toContain("20% advance");
    expect(noShow).toContain("Nothing more is charged");
    expect(noShow.toLowerCase()).not.toContain("cancel");
  });
  it("full-online no-show line: keeps 20% of service, remainder (incl unused pickup/drop) to owner refund approval, never auto", () => {
    const { noShowFullOnline } = advanceDisclosureLines();
    expect(noShowFullOnline).toContain("20% of the discounted service price including GST");
    expect(noShowFullOnline).toContain("unused pickup and drop charges and their GST");
    expect(noShowFullOnline).toContain("refund approval");
    expect(noShowFullOnline).toContain("nothing is refunded automatically");
    expect(noShowFullOnline.toLowerCase()).not.toContain("cancel");
  });
});
