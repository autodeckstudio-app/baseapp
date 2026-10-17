import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { liveJobOf, recentDistinctServices } from "./bookings-view";

const read = (f: string) => readFileSync(`${__dirname}/../${f}`, "utf8");

describe("bookings view helpers", () => {
  it("finds the job that is in the studio and ignores finished or waiting ones", () => {
    expect(liveJobOf([{ id: "a", status: "DELIVERED" }, { id: "b", status: "PENDING_VEHICLE" }])).toBeNull();
    expect(liveJobOf([{ id: "a", status: "DELIVERED" }, { id: "b", status: "IN_PROGRESS" }])?.id).toBe("b");
  });
  it("returns the last 3 distinct finished services, newest first", () => {
    const b = (id: string, serviceId: string, at: string, status = "COMPLETED") => ({ id, serviceId, scheduledAt: at, status });
    const out = recentDistinctServices([b("1", "s1", "2026-01-01"), b("2", "s2", "2026-02-01"), b("3", "s1", "2026-03-01"), b("4", "s3", "2026-04-01"), b("5", "s4", "2026-05-01"), b("6", "s5", "2026-06-01", "CANCELLED")]);
    expect(out.map((x) => x.serviceId)).toEqual(["s4", "s3", "s1"]);
  });
});

describe("Bookings screen holds only booking content", () => {
  const s = read("app/(tabs)/bookings/index.tsx");
  it("has no Explore, membership, referral or documents blocks", () => {
    for (const w of ["Explore", "Membership", "referral", "Bring a friend", "PhotoCard", "Care map", "papers"]) expect(s).not.toContain(w);
  });
  it("sections come in the agreed order", () => {
    const at = ["In the studio", "Waiting for your OK", "Next visit", "Book again", "No past visits"].map((k) => s.indexOf(k));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it("has Active, Upcoming and Past chips", () => {
    for (const k of ["Active", "Upcoming", "Past"]) expect(s).toContain(`label: "${k}"`);
  });
  it("approvals open the existing approval screen and are never decided inline", () => {
    expect(s).toContain("/(tabs)/approvals/");
    expect(s).not.toContain("respondToApproval");
  });
  it("reschedule and cancel use the shared rules", () => {
    expect(s).toContain("getRescheduleEligibility");
    expect(s).toContain("cancelState");
  });
});

import { liveTrackTarget } from "./bookings-view";
describe("Home Track target", () => {
  it("uses the job's booking, falls back to the job id for a walk-in, and never another booking", () => {
    expect(liveTrackTarget({ id: "j1", bookingId: "b1" }, "other")).toBe("b1");
    expect(liveTrackTarget({ id: "j2" }, "other")).toBe("j2");
    expect(liveTrackTarget(null, "b9")).toBe("b9");
    expect(liveTrackTarget(null, null)).toBeNull();
  });
  it("Home never leaves Track / Next visit as a silent no-op", () => {
    const h = readFileSync(`${__dirname}/../app/(tabs)/index.tsx`, "utf8");
    expect(h).not.toContain(": undefined) }");
    expect(h).toContain('"/(tabs)/bookings"');
  });
});

import { groupByMonth, daysUntilLabel } from "./bookings-view";
describe("past visits by month", () => {
  const b = (d: string) => ({ scheduledDate: d, scheduledAt: `${d}T10:00:00Z` });
  it("groups newest month first, newest visit first inside", () => {
    const g = groupByMonth([b("2026-08-03"), b("2026-09-20"), b("2026-09-02"), b("2025-12-30")]);
    expect(g.map((x) => x.label)).toEqual(["September 2026", "August 2026", "December 2025"]);
    expect(g[0]!.items.map((x) => x.scheduledDate)).toEqual(["2026-09-20", "2026-09-02"]);
  });
  it("gives nothing for no visits", () => expect(groupByMonth([])).toEqual([]));
});
describe("days until a visit", () => {
  it("names today, tomorrow and later", () => {
    expect(daysUntilLabel("2026-10-17", "2026-10-17")).toBe("Today");
    expect(daysUntilLabel("2026-10-18", "2026-10-17")).toBe("Tomorrow");
    expect(daysUntilLabel("2026-10-22", "2026-10-17")).toBe("In 5 days");
    expect(daysUntilLabel("2026-10-10", "2026-10-17")).toBe("Date has passed");
  });
});
