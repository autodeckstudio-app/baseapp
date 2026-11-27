import { describe, expect, it } from "vitest";
import { activeReservationIntervals, bayReservationId, collectionEstimateOnRead, reservationsFromPlan, reservationsToRelease, type BayReservation } from "./bay-reservations.js";
import { planVisit, type VisitService } from "./visit-plan.js";
import type { PlanBay } from "./service-stages.js";

// Fixtures only (approved layout 2 Wash, 2 PPF, 3 Garage; PPF 480 and Ceramic 300 are the approved main durations).
const BAYS: PlanBay[] = [
  { id: "wash-1", bayType: "wash", active: true }, { id: "wash-2", bayType: "wash", active: true },
  { id: "ppf-1", bayType: "protection", active: true }, { id: "ppf-2", bayType: "protection", active: true },
  { id: "gar-1", bayType: "general", active: true }, { id: "gar-2", bayType: "general", active: true }, { id: "gar-3", bayType: "general", active: true },
];
const wash: VisitService = { id: "wash", name: "Regular Wash", requiredBayType: "wash", estimatedDurationMinutes: 30 };
const ppf: VisitService = { id: "ppf", name: "PPF", requiredBayType: "protection", estimatedDurationMinutes: 480 };
const garage: VisitService = { id: "ac", name: "AC check", requiredBayType: "general", estimatedDurationMinutes: 45 };
const plan = planVisit({ arrivalAt: new Date("2027-01-04T09:00:00.000Z"), services: [wash, garage, ppf], order: ["wash", "ac", "ppf"], bays: BAYS, occupancy: { planned: [], holds: [] }, workEnd: (s, m) => new Date(s.getTime() + m * 60000), transferMinutes: 0 })!;
const ctx = { tenantId: "t", studioId: "s", bookingId: "bk1", jobId: "job1", createdAt: "2027-01-01T00:00:00.000Z" };

describe("bay reservations", () => {
  it("one active reservation per scheduled stage, owned by its service line, with deterministic ids", () => {
    const rs = reservationsFromPlan(plan, ctx);
    expect(rs.map((r) => [r.id, r.serviceId, r.bayType, r.status])).toEqual([
      ["bk1__wash__0", "wash", "wash", "active"],
      ["bk1__ac__0", "ac", "general", "active"],
      ["bk1__ppf__0", "ppf", "protection", "active"],
    ]);
    expect(reservationsFromPlan(plan, ctx).map((r) => r.id)).toEqual(rs.map((r) => r.id)); // a retry yields the same ids
    for (const r of rs) expect(Date.parse(r.blockedUntil) - Date.parse(r.endAt)).toBe(15 * 60000);
    expect(new Set(rs.map((r) => r.bayId)).size).toBe(3); // three bays held independently by one booking
  });

  it("rejects ids that could collide", () => {
    expect(() => bayReservationId("bk/1", "wash", 0)).toThrow(RangeError);
    expect(() => bayReservationId("bk1", "wash", -1)).toThrow(RangeError);
  });

  it("releasing one service line selects only that line's active reservations, never another line's or booking's", () => {
    const rs = reservationsFromPlan(plan, ctx);
    const other = reservationsFromPlan(plan, { ...ctx, bookingId: "bk2" });
    expect(reservationsToRelease([...rs, ...other], "bk1", ["ac"])).toEqual(["bk1__ac__0"]);
    const released = rs.map((r): BayReservation => (r.serviceId === "ac" ? { ...r, status: "released" } : r));
    expect(reservationsToRelease(released, "bk1", ["ac"])).toEqual([]);
    expect(reservationsToRelease(released, "bk1", ["wash", "ppf"])).toEqual(["bk1__wash__0", "bk1__ppf__0"]);
  });

  it("active reservations are planned occupancy per bay; released ones and the caller's own booking are skipped", () => {
    const rs = reservationsFromPlan(plan, ctx);
    const map = activeReservationIntervals(rs);
    expect([...map.keys()].sort()).toEqual(rs.map((r) => r.bayId).sort());
    expect(activeReservationIntervals(rs, "bk1").size).toBe(0);
    expect(activeReservationIntervals(rs.map((r) => ({ ...r, status: "released" as const }))).size).toBe(0);
    expect(() => activeReservationIntervals([{ ...rs[0]!, blockedUntil: "nope" }])).toThrow(RangeError);
  });
});

describe("collection estimate derived on read", () => {
  it("is the latest completion among retained lines, excluding CANCELLED and DELIVERED lines", () => {
    const lines = [
      { serviceId: "wash", status: "IN_PROGRESS", estimatedCompletionAt: "2027-01-04T09:30:00.000Z" },
      { serviceId: "ppf", status: "PENDING_VEHICLE", estimatedCompletionAt: "2027-01-04T18:15:00.000Z" },
      { serviceId: "ac", status: "CANCELLED", estimatedCompletionAt: "2027-01-04T23:00:00.000Z" },
    ];
    expect(collectionEstimateOnRead(lines)).toBe("2027-01-04T18:15:00.000Z");
    expect(collectionEstimateOnRead(lines.map((l) => (l.serviceId === "ppf" ? { ...l, status: "DELIVERED" } : l)))).toBe("2027-01-04T09:30:00.000Z");
    expect(collectionEstimateOnRead(lines.map((l) => ({ ...l, status: "CANCELLED" })))).toBeNull();
  });
});
