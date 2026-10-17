import { describe, it, expect } from "vitest";
import { cancelState, cancelConfirmBody } from "./booking-rules";
import type { Booking } from "@autodeck/core";

const H = 3_600_000;
const now = Date.parse("2026-10-20T06:00:00Z");
const b = (hoursAhead: number, status = "CONFIRMED", total = 100_000) => ({ status, scheduledAt: new Date(now + hoursAhead * H).toISOString(), totalAmount: total, estimatedEndAt: new Date(now + (hoursAhead + 1) * H).toISOString(), scheduledDate: "2026-10-22", scheduledTime: "10:00" }) as unknown as Booking;

describe("customer cancel rules", () => {
  it("a wash is free early and Rs 100 inside 4 h, and can always be cancelled before the start", () => {
    expect(cancelState(b(10), now, "washing")).toMatchObject({ canCancel: true, feePaise: 0 });
    expect(cancelState(b(2), now, "washing")).toMatchObject({ canCancel: true, feePaise: 10000 });
  });
  it("a bigger service is free past 24 h and 20% inside", () => {
    expect(cancelState(b(30), now, "ceramic").feePaise).toBe(0);
    expect(cancelState(b(10, "CONFIRMED", 100_000), now, "ceramic").feePaise).toBe(20_000);
  });
  it("once the car is at the studio there is no online cancel", () => {
    expect(cancelState(b(1, "ACTIVE"), now, "washing")).toMatchObject({ canCancel: false, lateToCancel: true });
  });
  it("the confirm text shows the fee and, if paid, the refund timeline, with no em dash", () => {
    const t = cancelConfirmBody({ feePaise: 10000, line: "Line." }, true);
    expect(t).toContain("Rs 100"); expect(t).toContain("5 to 7 working days"); expect(t).not.toContain("\u2014");
    expect(cancelConfirmBody({ feePaise: 0, line: "Line." }, false)).not.toContain("costs");
  });
});
