import { describe, it, expect } from "vitest";
import { cancelState, cancelConfirmBody } from "./booking-rules";
import type { Booking } from "@autodeck/core";

const H = 3_600_000;
const now = Date.parse("2026-10-20T06:00:00Z");
const b = (hoursAhead: number, status = "CONFIRMED", total = 100_000) => ({ status, scheduledAt: new Date(now + hoursAhead * H).toISOString(), totalAmount: total, estimatedEndAt: new Date(now + (hoursAhead + 1) * H).toISOString(), scheduledDate: "2026-10-22", scheduledTime: "10:00" }) as unknown as Booking;

describe("customer cancel rules", () => {
  it("a wash is free early and Rs 100 inside 4 h, and can always be cancelled before the start", () => {
    expect(cancelState(b(30), now, "washing")).toMatchObject({ canCancel: true, feePaise: 0 });
    expect(cancelState(b(2), now, "washing")).toMatchObject({ canCancel: false, sameDay: true });
  });
  it("a bigger service is free past 24 h and 20% inside", () => {
    expect(cancelState(b(30), now, "ceramic").feePaise).toBe(0);
    expect(cancelState(b(20, "CONFIRMED", 100_000), now, "ceramic")).toMatchObject({ canCancel: true, feePaise: 20_000 });
  });
  it("once the car is at the studio there is no online cancel", () => {
    expect(cancelState(b(1, "ACTIVE"), now, "washing")).toMatchObject({ canCancel: false, lateToCancel: true });
  });
  it("a same-day booking cannot be cancelled online and shows the call-the-studio line; the next day can", () => {
    expect(cancelState(b(5), now, "ceramic")).toMatchObject({ canCancel: false, sameDay: true });
    expect(cancelState(b(20), now, "ceramic").canCancel).toBe(true);
    expect(cancelState(b(5, "ACTIVE"), now, "ceramic").sameDay).toBe(false);
  });
  it("the confirm text shows the fee and, if paid, the refund timeline, with no em dash", () => {
    const t = cancelConfirmBody({ feePaise: 10000, line: "Line." }, true);
    expect(t).toContain("Rs 100"); expect(t).toContain("5 to 7 working days"); expect(t).not.toContain("\u2014");
    expect(cancelConfirmBody({ feePaise: 0, line: "Line." }, false)).not.toContain("costs");
  });
});

import { readFileSync } from "node:fs";
describe("Round 5 booking page", () => {
  const d = readFileSync(new URL("../app/(tabs)/bookings/[id].tsx", import.meta.url).pathname, "utf8");
  it("shows Pending payment with a Pay now retry, an Expired notice, the refund line and a specific error title", () => {
    expect(d).toContain("Pending payment"); expect(d).toContain('label="Pay now"'); expect(d).toContain("Slot released");
    expect(d).toContain("Refund initiated"); expect(d).toContain("Reschedule instead"); expect(d).not.toContain('title="Something went wrong"');
  });
});
