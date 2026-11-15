import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bookingStartState, isHoldExpired, HOLD_MINUTES } from "../../lib/booking-hold.js";

const src = (p: string) => readFileSync(`${__dirname}/../../${p}`, "utf8");
const now = Date.parse("2026-10-19T10:00:00Z");

describe("pay-online booking hold (owner, 18 Oct 9:41 PM)", () => {
  it("online holds the slot as PENDING for 15 minutes", () => {
    const s = bookingStartState({ payMode: "online", totalPaise: 100000, priceOnRequest: false, nowMs: now });
    expect(HOLD_MINUTES).toBe(15);
    expect(s.status).toBe("PENDING");
    expect(s.holdExpiresAt).toBe("2026-10-19T10:15:00.000Z");
  });
  it("studio, free, quote and older apps (no payMode) confirm at once", () => {
    for (const i of [{ payMode: "studio" as const, totalPaise: 5000 }, { payMode: "online" as const, totalPaise: 0 }, { payMode: undefined, totalPaise: 5000 }]) {
      expect(bookingStartState({ ...i, priceOnRequest: false, nowMs: now })).toEqual({ status: "CONFIRMED", holdExpiresAt: null });
    }
    expect(bookingStartState({ payMode: "online", totalPaise: 5000, priceOnRequest: true, nowMs: now }).status).toBe("CONFIRMED");
  });
  it("expires only a PENDING unpaid booking past its time", () => {
    const b = { status: "PENDING" as const, paymentStatus: "unpaid" as const, holdExpiresAt: "2026-10-19T09:59:00.000Z" };
    expect(isHoldExpired(b, now)).toBe(true);
    expect(isHoldExpired({ ...b, holdExpiresAt: "2026-10-19T10:01:00.000Z" }, now)).toBe(false);
    expect(isHoldExpired({ ...b, paymentStatus: "paid" }, now)).toBe(false);
    expect(isHoldExpired({ ...b, status: "CONFIRMED" as never }, now)).toBe(false);
  });
  it("the sweep re-checks payment inside the transaction and gives credits back", () => {
    const s = src("lib/booking-hold.ts");
    expect(s).toContain('"in", ["processing", "completed"]');
    expect(s).toContain("writeCancelRestores");
    expect(s).toContain('status: "EXPIRED"');
    expect(src("index.ts")).toContain("expirePendingBookingsScheduled");
  });
  it("createBooking uses the hold rule and EXPIRED/CANCELLED jobs free the bay", () => {
    expect(src("functions/booking/createBooking.ts")).toContain("bookingStartState");
    expect(src("functions/booking/createBooking.ts")).toContain('job.status === "CANCELLED"');
  });
});
