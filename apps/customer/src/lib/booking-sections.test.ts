import { describe, it, expect } from "vitest";
import { bookingSections } from "./booking-sections";

const b = (status: string, scheduledAt: string) => ({ status, scheduledAt });
describe("bookingSections", () => {
  it("puts a car already in the studio under inStudio, not coming up", () => {
    const s = bookingSections([b("ACTIVE", "2026-10-09T11:29:00Z"), b("CONFIRMED", "2026-10-20T10:00:00Z")]);
    expect(s.inStudio).toHaveLength(1);
    expect(s.upcoming).toHaveLength(1);
    expect(s.upcoming[0]?.status).toBe("CONFIRMED");
  });
  it("puts finished and cancelled visits in past", () => {
    const s = bookingSections([b("COMPLETED", "2026-10-01T10:00:00Z"), b("CANCELLED", "2026-10-02T10:00:00Z")]);
    expect(s.past).toHaveLength(2);
    expect(s.inStudio).toHaveLength(0);
    expect(s.upcoming).toHaveLength(0);
  });
  it("sorts upcoming soonest first", () => {
    const s = bookingSections([b("PENDING", "2026-10-22T10:00:00Z"), b("CONFIRMED", "2026-10-20T10:00:00Z")]);
    expect(s.upcoming.map((x) => x.scheduledAt)).toEqual(["2026-10-20T10:00:00Z", "2026-10-22T10:00:00Z"]);
  });
});

import { lastCompletedService } from "./booking-sections";
describe("one-tap rebook", () => {
  it("offers the most recent completed visit that had a service", () => {
    const l = [
      { id: "a", status: "COMPLETED", scheduledAt: "2026-09-01T10:00", serviceId: "s1" },
      { id: "b", status: "COMPLETED", scheduledAt: "2026-10-01T10:00", serviceId: "s2" },
      { id: "c", status: "CANCELLED", scheduledAt: "2026-10-10T10:00", serviceId: "s3" },
      { id: "d", status: "COMPLETED", scheduledAt: "2026-10-12T10:00", serviceId: null },
    ];
    expect(lastCompletedService(l)?.id).toBe("b");
    expect(lastCompletedService([])).toBeNull();
  });
});
