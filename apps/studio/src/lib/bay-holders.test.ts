import { describe, it, expect } from "vitest";
import { bayOccupancy } from "./bay-holders";
import type { ServiceJob } from "@autodeck/core";

const NOW = Date.parse("2026-10-29T10:00:00Z");
const job = (id: string, status: string, start: string, end: string, bayId = "b1") =>
  ({ id, status, bayId, scheduledAt: start, estimatedEndAt: end }) as unknown as ServiceJob;

describe("bayOccupancy", () => {
  it("returns both started jobs in one bay as a conflict, ordered by slot, without choosing one", () => {
    const old = job("old", "IN_PROGRESS", "2026-10-26T08:30:00Z", "2026-10-26T09:15:00Z");
    const today = job("today", "IN_PROGRESS", "2026-10-29T09:30:00Z", "2026-10-29T10:15:00Z");
    const r = bayOccupancy([today, old], "b1", NOW);
    expect(r.conflict).toBe(true);
    expect(r.jobs.map((j) => j.id)).toEqual(["old", "today"]);
  });
  it("a single holder is not a conflict", () => {
    const r = bayOccupancy([job("a", "IN_PROGRESS", "2026-10-29T09:30:00Z", "2026-10-29T10:15:00Z")], "b1", NOW);
    expect(r).toMatchObject({ conflict: false });
    expect(r.jobs).toHaveLength(1);
  });
  it("a later booking still waiting for its car is not a second car", () => {
    const r = bayOccupancy([
      job("p", "PENDING_VEHICLE", "2026-10-29T11:00:00Z", "2026-10-29T11:45:00Z"),
      job("a", "IN_PROGRESS", "2026-10-29T09:30:00Z", "2026-10-29T10:15:00Z"),
    ], "b1", NOW);
    expect(r.conflict).toBe(false);
    expect(r.jobs.map((j) => j.id)).toEqual(["a"]);
  });
  it("ignores other bays, finished and cancelled jobs", () => {
    const r = bayOccupancy([
      job("x", "IN_PROGRESS", "2026-10-29T09:30:00Z", "2026-10-29T10:15:00Z", "b2"),
      job("d", "DELIVERED", "2026-10-28T09:30:00Z", "2026-10-28T10:15:00Z"),
      job("c", "CANCELLED", "2026-10-28T09:30:00Z", "2026-10-28T10:15:00Z"),
    ], "b1", NOW);
    expect(r.jobs).toHaveLength(0);
  });
  it("two waiting bookings show only the first", () => {
    const r = bayOccupancy([
      job("p1", "PENDING_VEHICLE", "2026-10-29T11:00:00Z", "2026-10-29T11:45:00Z"),
      job("p2", "PENDING_VEHICLE", "2026-10-29T12:00:00Z", "2026-10-29T12:45:00Z"),
    ], "b1", NOW);
    expect(r.jobs).toHaveLength(1);
    expect(r.conflict).toBe(false);
  });
  it("orders by real time, not text, when offsets differ", () => {
    const a = job("a", "IN_PROGRESS", "2026-10-29T09:00:00+05:30", "2026-10-29T09:45:00+05:30"); // 03:30Z
    const b = job("b", "IN_PROGRESS", "2026-10-29T05:00:00Z", "2026-10-29T05:45:00Z"); // later in time, earlier as text
    expect(bayOccupancy([b, a], "b1", NOW).jobs.map((j) => j.id)).toEqual(["a", "b"]);
  });
});
