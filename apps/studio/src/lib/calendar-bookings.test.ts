import { describe, it, expect } from "vitest";
import { dayRangeIST, bookedNotArrived } from "./calendar-bookings";

describe("calendar bookings", () => {
  it("covers exactly one India day", () => {
    const r = dayRangeIST("2026-10-27");
    expect(r.start).toBe("2026-10-26T18:30:00.000Z");
    expect(r.end).toBe("2026-10-27T18:29:59.999Z");
  });
  it("lists confirmed and pending bookings that have no job, in time order", () => {
    const b = [
      { id: "b3", status: "CONFIRMED", scheduledAt: "2026-10-27T09:00:00.000Z" },
      { id: "b1", status: "PENDING", scheduledAt: "2026-10-27T04:00:00.000Z" },
      { id: "b2", status: "CONFIRMED", scheduledAt: "2026-10-27T05:00:00.000Z" },
      { id: "b4", status: "CANCELLED", scheduledAt: "2026-10-27T06:00:00.000Z" },
      { id: "b5", status: "ACTIVE", scheduledAt: "2026-10-27T07:00:00.000Z" },
    ] as never;
    const out = bookedNotArrived(b, [{ bookingId: "b2" }, { bookingId: null }]);
    expect(out.map((x) => x.id)).toEqual(["b1", "b3"]);
  });
});
