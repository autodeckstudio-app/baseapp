import { describe, it, expect } from "vitest";
import { refundOwedText, refundsOwedTotalText, owedFromBookings } from "./refund-owed-copy";

describe("refund owed copy", () => {
  it("a missing server total never prints undefined or a dash as an amount", () => {
    const t = refundsOwedTotalText(undefined as unknown as number, undefined as unknown as number, undefined as unknown as boolean);
    expect(t).toMatch(/could not be totalled/);
    expect(t).not.toMatch(/undefined|NaN| - /);
  });
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
  it("list/dashboard total: cancelled only, honest on a full list or an unusable amount", () => {
    const l = [
      { status: "CANCELLED", manualRefundDuePaise: 10000 }, { status: "CANCELLED", manualRefundDuePaise: 5000 },
      { status: "CONFIRMED", manualRefundDuePaise: 99999 }, { status: "CANCELLED" }, { status: "CANCELLED", manualRefundDuePaise: 0 },
    ];
    expect(owedFromBookings(l, false)).toEqual({ paise: 15000, count: 2, truncated: false });
    expect(owedFromBookings(l, true).truncated).toBe(true);
    expect(owedFromBookings([...l, { status: "CANCELLED", manualRefundDuePaise: -1 }, { status: "CANCELLED", manualRefundDuePaise: Number.NaN }], false)).toEqual({ paise: 15000, count: 2, truncated: true });
    expect(refundsOwedTotalText(15000, 2, true)).toMatch(/may be incomplete/);
  });
});
