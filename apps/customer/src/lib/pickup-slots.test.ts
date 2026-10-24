import { describe, expect, it } from "vitest";
import { pickupSlotsFor, PICKUP_SLOT_OPEN } from "./pickup-slots";

describe("pickupSlotsFor", () => {
  it("offers hourly slots from studio open up to and including the booking time", () => {
    expect(pickupSlotsFor("12:00")).toEqual(["10:00", "11:00", "12:00"]);
  });
  it("a 10 AM booking cannot have an 11 AM pickup", () => {
    const slots = pickupSlotsFor("10:00");
    expect(slots).toEqual(["10:00"]);
    expect(slots).not.toContain("11:00");
  });
  it("never offers a slot after the booking time", () => {
    for (const t of ["10:00", "13:00", "18:30", "21:00"]) {
      const slots = pickupSlotsFor(t);
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s <= t)).toBe(true);
    }
  });
  it("keeps a non-hourly booking time choosable as the last slot", () => {
    expect(pickupSlotsFor("10:30")).toEqual(["10:00", "10:30"]);
  });
  it("starts at the studio opening time by default and honours a different open", () => {
    expect(pickupSlotsFor("11:00")[0]).toBe(PICKUP_SLOT_OPEN);
    expect(pickupSlotsFor("11:00", "09:00")).toEqual(["09:00", "10:00", "11:00"]);
  });
  it("returns no slots when the booking time is missing or unreadable", () => {
    expect(pickupSlotsFor("")).toEqual([]);
    expect(pickupSlotsFor("not-a-time")).toEqual([]);
    expect(pickupSlotsFor("25:00")).toEqual([]);
  });
});
