import { describe, it, expect } from "vitest";
import { pickupFeeLabel, confirmBlockReason, checkAgreedTime } from "./pickup-form";

describe("pickup fee label", () => {
  it("says so when there is no price", () => expect(pickupFeeLabel(null)).toMatch(/admin sets it/));
  it("labels a both-ways fee as a total with each leg", () => expect(pickupFeeLabel(20000, null, "both")).toBe("Rs 200 total (Rs 100 each way)"));
  it("formats paise", () => { expect(pickupFeeLabel(15000)).toBe("Rs 150"); expect(pickupFeeLabel(0)).toBe("Free"); expect(pickupFeeLabel(15000, "m1")).toBe("Free with membership"); });
});
describe("confirm gate", () => {
  it("blocks an unpriced new request only", () => {
    expect(confirmBlockReason({ status: "REQUESTED", feePaise: null })).toMatch(/Admin/);
    expect(confirmBlockReason({ status: "REQUESTED" })).toMatch(/Admin/);
    expect(confirmBlockReason({ status: "REQUESTED", feePaise: 0 })).toBeNull();
    expect(confirmBlockReason({ status: "CONFIRMED", feePaise: null })).toBeNull();
  });
});
describe("agreed time", () => {
  const now = new Date("2026-10-26T06:00:00Z"); // 11:30 IST
  it("accepts a future IST time", () => expect(checkAgreedTime("2026-10-26 16:30", now)).toEqual({ ok: true, value: "2026-10-26 16:30" }));
  it("accepts the picker T form", () => expect(checkAgreedTime("2026-10-27T09:00", now)).toEqual({ ok: true, value: "2026-10-27 09:00" }));
  it("rejects past, impossible and malformed", () => {
    expect(checkAgreedTime("2026-10-26 10:00", now).ok).toBe(false);
    expect(checkAgreedTime("2026-02-30 10:00", now).ok).toBe(false);
    expect(checkAgreedTime("2026-10-27 25:00", now).ok).toBe(false);
    expect(checkAgreedTime("tomorrow", now).ok).toBe(false);
  });
  it("compares in India time, not UTC", () => expect(checkAgreedTime("2026-10-26 11:40", now).ok).toBe(true));
});
