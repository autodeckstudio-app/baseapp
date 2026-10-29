import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { cancelState, cancelConfirmBody } from "./booking-rules";
import type { Booking } from "@autodeck/core";

const H = 3_600_000;
const now = Date.parse("2026-10-20T06:00:00Z");
const b = (hoursAhead: number, status = "CONFIRMED", total = 100_000) => ({ status, scheduledAt: new Date(now + hoursAhead * H).toISOString(), totalAmount: total, estimatedEndAt: new Date(now + (hoursAhead + 1) * H).toISOString(), scheduledDate: "2026-10-22", scheduledTime: "10:00" }) as unknown as Booking;

describe("customer cancel rules", () => {
  it("a wash is free early and Rs 100 inside 4 h, and can always be cancelled before the start", () => {
    expect(cancelState(b(30), now, "washing")).toMatchObject({ canCancel: true, feePaise: 0 });
    expect(cancelState(b(2), now, "washing")).toMatchObject({ canCancel: true, feePaise: 10_000 });
  });
  it("a bigger service is free past 24 h and 20% inside", () => {
    expect(cancelState(b(30), now, "ceramic").feePaise).toBe(0);
    expect(cancelState(b(20, "CONFIRMED", 100_000), now, "ceramic")).toMatchObject({ canCancel: true, feePaise: 20_000 });
  });
  it("once the car is at the studio there is no online cancel", () => {
    expect(cancelState(b(1, "ACTIVE"), now, "washing")).toMatchObject({ canCancel: false, lateToCancel: true });
  });
  it("same-day cancel is allowed (owner, 20 Oct 4:35 PM): a wash inside 4 h costs Rs 100 and is shown before confirming; a big service keeps 24 h / 20%", () => {
    const w = cancelState(b(2), now, "washing");
    expect(w).toMatchObject({ canCancel: true, feePaise: 10_000 });
    expect(cancelConfirmBody(w, false)).toContain("Cancelling now costs Rs 100");
    expect(cancelState(b(5), now, "ceramic")).toMatchObject({ canCancel: true, feePaise: 20_000 });
    expect(cancelState(b(5), now, "washing")).toMatchObject({ canCancel: true, feePaise: 0 });
    expect(cancelState(b(5, "ACTIVE"), now, "ceramic")).toMatchObject({ canCancel: false, lateToCancel: true });
  });
  it("no day-before block or line is left anywhere in the app", () => {
    for (const f of ["./booking-rules.ts", "../app/(tabs)/bookings/[id].tsx"]) { const t = readFileSync(new URL(f, import.meta.url).pathname, "utf8"); expect(t).not.toContain("until the day before"); expect(t).not.toContain("SAME_DAY"); }
  });
  it("the confirm text shows the fee and, if paid, the refund route as a recorded request, with no em dash", () => {
    const t = cancelConfirmBody({ feePaise: 10000, line: "Line." }, true);
    expect(t).toContain("Rs 100"); expect(t).not.toContain("working days"); expect(t).not.toContain("\u2014");
    expect(t).toContain("refund request will be recorded"); expect(t).not.toContain("will be refunded");
    expect(cancelConfirmBody({ feePaise: 0, line: "Line." }, false)).not.toContain("costs");
  });
});

describe("Round 5 booking page", () => {
  const d = readFileSync(new URL("../app/(tabs)/bookings/[id].tsx", import.meta.url).pathname, "utf8");
  it("shows Pending payment with a Pay now retry, an Expired notice, the refund line and a specific error title", () => {
    expect(d).toContain("Pending payment"); expect(d).toContain('label="Pay now"'); expect(d).toContain("Slot released");
    expect(d).toContain("Refund recorded"); expect(d).toContain("Reschedule instead"); expect(d).not.toContain('title="Something went wrong"');
  });
});

import { expectedReady } from "./booking-rules";
import { DEV_SAMPLE_BOOKING } from "./booking-dev-sample";
describe("expected ready never precedes the start", () => {
  const base = { scheduledAt: "2026-10-23T04:30:00.000Z", estimatedEndAt: "2026-10-23T06:00:00.000Z" } as const;
  it("uses the studio end date and time when it is after the start (IST)", () => {
    expect(expectedReady({ ...base, estimatedEndDate: "2026-10-23", estimatedEndTime: "11:30" })).toEqual({ date: "2026-10-23", time: "11:30" });
  });
  it("a stored end before the start falls back to estimatedEndAt, or hides when that is wrong too", () => {
    expect(expectedReady({ ...base, estimatedEndDate: "2026-10-22", estimatedEndTime: "11:30" })).toEqual({ date: "2026-10-23", time: "11:30" });
    expect(expectedReady({ scheduledAt: base.scheduledAt, estimatedEndAt: "2026-10-23T01:00:00.000Z", estimatedEndDate: "2026-10-22", estimatedEndTime: "11:30" })).toBeNull();
  });
  it("the dev sample booking is internally consistent", () => {
    const r = expectedReady(DEV_SAMPLE_BOOKING);
    expect(r).not.toBeNull();
    expect(`${r!.date}T${r!.time}`).toBe(`${DEV_SAMPLE_BOOKING.scheduledDate}T11:30`);
  });
});

describe("booking hero chips stay readable on the dark hero in Day mode", () => {
  it("both hero chips use onDark", () => {
    const src = readFileSync(`${__dirname}/../app/(tabs)/bookings/[id].tsx`, "utf8");
    expect(src).toContain('<Chip label="Live" tone="accent" onDark />');
    expect(src).toMatch(/BOOKING_CHIP_TONE\[booking\.status\] \?\? "neutral"\} onDark \/>/);
  });
});

describe("booking page text stays readable in Night", () => {
  const src = readFileSync(`${__dirname}/../app/(tabs)/bookings/[id].tsx`, "utf8");
  it("Time, Duration, Expected ready and Payment rows use the stronger detail tone", () => {
    for (const t of ["Time", "Duration", "Expected ready", "Payment"]) expect(src).toMatch(new RegExp(t === "Expected ready" ? `<Row detailTone="secondary" title=\\{readyRowTitle\\(vt\\?\\.phase\\)\\}` : `<Row detailTone="secondary" title="${t}"`));
  });
  it("the reschedule explanation is not tertiary", () => {
    expect(src).not.toMatch(/tone="tertiary">\{rescheduleEligibility\.reason\}/);
    expect(src).not.toMatch(/tone="tertiary">Payment status is/);
  });
});

import { readFileSync as _rf } from "node:fs";
import { join as _join } from "node:path";
describe("refund notices (source guard, not rendered proof)", () => {
  const src = _rf(_join(__dirname, "../app/(tabs)/bookings/[id].tsx"), "utf8");
  it("drops the unfulfillable promise and states provider status only", () => {
    expect(src).not.toContain("We will update here when it is complete");
    // The backend writes "requested" at reserve time: the recorded-request
    // notice must actually fire for it, and must not promise payment.
    expect(src).toContain('booking.refundStatus === "requested"');
    expect(src.slice(src.indexOf('booking.refundStatus === "requested"'), src.indexOf('booking.refundStatus === "requested"') + 200)).toContain("Your refund request is recorded");
    expect(src).toContain("Razorpay reports your refund as processed");
    // initiated is written by the MANUAL cash/UPI path too: the notice must
    // stay mechanism-neutral and must not claim the provider accepted it.
    expect(src).not.toContain("Razorpay has accepted your refund");
    expect(src).toContain("The studio has recorded your refund");
    expect(src).not.toMatch(/\d+\s*(-\s*\d+\s*)?(working |business )?days/i.exec(src.slice(src.indexOf('refundStatus === "processed"'), src.indexOf('refundStatus === "processed"') + 300))?.[0] ?? "NOPE_XYZ");
  });
});
