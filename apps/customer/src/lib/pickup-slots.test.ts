import { describe, expect, it } from "vitest";
import { pickupDayHoursFor, pickupSlotOptions, pickupSlotsFor, validPickupSlot, type PickupDayHours } from "./pickup-slots";
import type { LiveStudioInfo } from "./studio-info";

const loading: PickupDayHours = { status: "loading" };
const unavailable: PickupDayHours = { status: "unavailable" };

// A studio open 10:00-21:00 Monday to Saturday, closed Sunday, in the live
// record shape the booking engine reads.
const info: LiveStudioInfo = {
  operatingHours: [
    { dayOfWeek: 0, open: "10:00", close: "19:00", closed: true },
    { dayOfWeek: 1, open: "10:00", close: "21:00", closed: false },
    { dayOfWeek: 2, open: "10:00", close: "21:00", closed: false },
    { dayOfWeek: 3, open: "10:00", close: "21:00", closed: false },
    { dayOfWeek: 4, open: "10:00", close: "21:00", closed: false },
    { dayOfWeek: 5, open: "10:00", close: "21:00", closed: false },
    { dayOfWeek: 6, open: "09:00", close: "21:00", closed: false },
  ],
  holidays: [],
};

describe("pickupSlotsFor", () => {
  it("offers hourly slots from the booking day's open up to and including the booking time", () => {
    expect(pickupSlotsFor("12:00", "10:00")).toEqual(["10:00", "11:00", "12:00"]);
  });
  it("a 10 AM booking cannot have an 11 AM pickup", () => {
    const slots = pickupSlotsFor("10:00", "10:00");
    expect(slots).toEqual(["10:00"]);
    expect(slots).not.toContain("11:00");
  });
  it("never offers a slot after the booking time", () => {
    for (const t of ["10:00", "13:00", "18:30", "21:00"]) {
      const slots = pickupSlotsFor(t, "09:00");
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s <= t)).toBe(true);
    }
  });
  it("keeps a non-hourly booking time choosable as the last slot", () => {
    expect(pickupSlotsFor("10:30", "10:00")).toEqual(["10:00", "10:30"]);
  });
  it("honours the booking day's actual open, including earlier non-hour opens", () => {
    expect(pickupSlotsFor("11:00", "09:00")).toEqual(["09:00", "10:00", "11:00"]);
    expect(pickupSlotsFor("11:00", "09:30")).toEqual(["09:30", "10:30", "11:00"]);
  });
  it("returns no slots when the booking time is missing or unreadable", () => {
    expect(pickupSlotsFor("", "09:00")).toEqual([]);
    expect(pickupSlotsFor("not-a-time", "09:00")).toEqual([]);
    expect(pickupSlotsFor("25:00", "09:00")).toEqual([]);
  });
});

describe("pickupDayHoursFor", () => {
  it("reads the booking day's hours from the live record by calendar weekday", () => {
    // 2026-10-24 is a Saturday (dayOfWeek 6, opens 09:00 here).
    expect(pickupDayHoursFor(info, "2026-10-24")).toEqual({ status: "open", open: "09:00" });
    // 2026-10-26 is a Monday (dayOfWeek 1, opens 10:00).
    expect(pickupDayHoursFor(info, "2026-10-26")).toEqual({ status: "open", open: "10:00" });
  });
  it("a closed day is unavailable, never an invented default", () => {
    // 2026-10-25 is a Sunday, closed above.
    expect(pickupDayHoursFor(info, "2026-10-25")).toEqual({ status: "unavailable" });
  });
  it("a missing hours entry is unavailable", () => {
    const sparse: LiveStudioInfo = { operatingHours: [{ dayOfWeek: 1, open: "10:00", close: "21:00", closed: false }], holidays: [] };
    expect(pickupDayHoursFor(sparse, "2026-10-24")).toEqual({ status: "unavailable" });
  });
  it("a missing date is unavailable", () => {
    expect(pickupDayHoursFor(info, "")).toEqual({ status: "unavailable" });
  });
});

describe("pickupSlotOptions", () => {
  it("is empty while hours load - no invented slots", () => {
    expect(pickupSlotOptions("12:00", loading)).toEqual([]);
  });
  it("is empty after a failed fetch - no invented slots", () => {
    expect(pickupSlotOptions("12:00", unavailable)).toEqual([]);
  });
  it("is empty on a closed day", () => {
    expect(pickupSlotOptions("12:00", pickupDayHoursFor(info, "2026-10-25"))).toEqual([]);
  });
  it("is empty without a scheduled time", () => {
    expect(pickupSlotOptions(undefined, { status: "open", open: "10:00" })).toEqual([]);
  });
  it("lists slots from the grounded open once hours arrive", () => {
    expect(pickupSlotOptions("12:00", { status: "open", open: "10:00" })).toEqual(["10:00", "11:00", "12:00"]);
    expect(pickupSlotOptions("12:00", pickupDayHoursFor(info, "2026-10-24"))).toEqual(["09:00", "10:00", "11:00", "12:00"]);
  });
});

describe("validPickupSlot", () => {
  it("keeps a choice that is still one of the current options", () => {
    expect(validPickupSlot("10:00", ["10:00", "11:00"])).toBe("10:00");
  });
  it("drops a choice made before live hours arrived when the real open is later", () => {
    // Chosen while only "10:00" onward was known; live hours say the day
    // opens 11:00, so 10:00 must go.
    expect(validPickupSlot("10:00", ["11:00", "12:00"])).toBe("");
  });
  it("drops a choice when the date changes and the option list shifts", () => {
    expect(validPickupSlot("09:00", ["10:00", "11:00"])).toBe("");
  });
  it("drops a choice when hours become unavailable", () => {
    expect(validPickupSlot("10:00", [])).toBe("");
  });
  it("leaves no-preference alone", () => {
    expect(validPickupSlot("", ["10:00"])).toBe("");
    expect(validPickupSlot("", [])).toBe("");
  });
});
