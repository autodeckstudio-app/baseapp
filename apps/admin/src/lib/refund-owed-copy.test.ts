import { describe, it, expect } from "vitest";
import { refundOwedText, refundsOwedTotalText } from "./refund-owed-copy";

describe("refund owed copy", () => {
  it("never says refunded, sent or initiated as done; says not yet returned", () => {
    const t = refundOwedText(10000);
    expect(t).toMatch(/not yet returned/); expect(t).toMatch(/not sent anything/);
    expect(t).not.toMatch(/refunded|initiated|accepted/i);
  });
  it("total: hidden when zero and complete; honest when truncated; says it is not netted", () => {
    expect(refundsOwedTotalText(0, 0, false)).toBeNull();
    expect(refundsOwedTotalText(25000, 2, false)).toMatch(/2 bookings.*not taken out of the figures above/);
    expect(refundsOwedTotalText(0, 0, true)).toMatch(/may be incomplete/);
    expect(refundsOwedTotalText(100, 1, false)).toMatch(/1 booking,/);
  });
});
