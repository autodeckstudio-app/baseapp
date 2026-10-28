import { describe, it, expect } from "vitest";
import { mergeFloorJobs } from "./floor-jobs";
import type { ServiceJob } from "@autodeck/core";

const job = (id: string, status: string, scheduledDate: string, estimatedEndDate: string): ServiceJob =>
  ({ id, status, scheduledDate, estimatedEndDate, scheduledAt: `${scheduledDate}T09:00:00.000Z` }) as unknown as ServiceJob;

describe("mergeFloorJobs (Studio floor must show what Admin shows as open)", () => {
  const today = "2026-10-28";
  const overrun = job("a", "IN_PROGRESS", "2026-10-26", "2026-10-26");
  const waiting = job("b", "READY_FOR_DELIVERY", "2026-10-19", "2026-10-19");
  const todays = job("c", "VEHICLE_RECEIVED", today, today);
  const done = job("d", "DELIVERED", "2026-10-20", "2026-10-20");

  it("old behaviour (window only) drops overrunning and waiting cars", () => {
    const ids = mergeFloorJobs([overrun, todays], [], today, true).map((j) => j.id);
    expect(ids).toEqual(["c"]);
  });
  it("keeps open carry-over jobs for today", () => {
    const ids = mergeFloorJobs([overrun, todays], [overrun, waiting, todays, done], today, true).map((j) => j.id);
    expect(ids).toEqual(["b", "a", "c"]);
  });
  it("never resurrects finished or cancelled jobs", () => {
    expect(mergeFloorJobs([], [done, job("e", "CANCELLED", "2026-10-20", "2026-10-20")], today, true)).toEqual([]);
  });
  it("does not add carry-over when viewing a future day", () => {
    expect(mergeFloorJobs([], [overrun, waiting], "2026-10-30", false)).toEqual([]);
  });
});
