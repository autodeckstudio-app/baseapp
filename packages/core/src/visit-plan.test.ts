import { describe, expect, it } from "vitest";
import { TURNOVER_BUFFER_MINUTES } from "./constants.js";
import { bayOccupancy, type BayOccupancy, type OccupancyJob, type PlannedReservation } from "./occupancy.js";
import { duplicateWash, type PlanBay } from "./service-stages.js";
import type { Service } from "./types/service.js";
import { occupiedFromOccupancy, planVisit, visitCollectionEstimate, type VisitService } from "./visit-plan.js";

// Fixtures only. Bays follow the approved customer-facing layout (2 Wash, 2 PPF, 3 Garage); there is no internal
// prep bay because preparation is staff-managed. PPF 480 and Ceramic 300 are the approved main-stage durations;
// other durations and transfer minutes are test values, not catalogue configuration or business decisions.
const BAYS: PlanBay[] = [
  { id: "wash-1", bayType: "wash", active: true }, { id: "wash-2", bayType: "wash", active: true },
  { id: "ppf-1", bayType: "protection", active: true }, { id: "ppf-2", bayType: "protection", active: true },
  { id: "gar-1", bayType: "general", active: true }, { id: "gar-2", bayType: "general", active: true },
  { id: "gar-3", bayType: "general", active: true },
];
type Svc = VisitService & Pick<Service, "standaloneExteriorWash" | "includesExteriorWash">;
const wash: Svc = { id: "wash", name: "Regular Wash", requiredBayType: "wash", estimatedDurationMinutes: 30, standaloneExteriorWash: true };
const ceramic: Svc = { id: "ceramic", name: "Standard Ceramic", requiredBayType: "protection", estimatedDurationMinutes: 300, includesExteriorWash: true };
const ppf: Svc = { id: "ppf", name: "PPF", requiredBayType: "protection", estimatedDurationMinutes: 480, includesExteriorWash: true };
const detailing: Svc = { id: "detail", name: "Exterior Detailing", requiredBayType: "protection", estimatedDurationMinutes: 120, includesExteriorWash: true };
const garage: Svc = { id: "ac", name: "AC check", requiredBayType: "general", estimatedDurationMinutes: 45 };

const at = (hhmm: string, day = "2027-01-04") => new Date(`${day}T${hhmm}:00.000Z`);
const iso = (hhmm: string, day = "2027-01-04") => at(hhmm, day).toISOString();
const plain = (start: Date, minutes: number) => new Date(start.getTime() + minutes * 60000);
const EMPTY: BayOccupancy = { planned: [], holds: [] };
const reserved = (bayId: string, from: string, to: string): PlannedReservation =>
  ({ bayId, jobId: `job-${bayId}-${from}`, interval: { startMs: at(from).getTime(), endMs: at(to).getTime() } });
const busy = (...r: PlannedReservation[]): BayOccupancy => ({ planned: r, holds: [] });

interface Opts { order?: string[]; start?: string; day?: string; occupancy?: BayOccupancy; transferMinutes?: number }
const plan = (services: Svc[], o: Opts = {}) => planVisit({
  arrivalAt: at(o.start ?? "09:00", o.day),
  services,
  order: o.order ?? services.map((s) => s.id), // explicit order supplied by the test
  bays: BAYS,
  occupancy: o.occupancy ?? EMPTY,
  workEnd: plain,
  transferMinutes: o.transferMinutes ?? 0,
});
const stagesOf = (p: ReturnType<typeof plan>) => p?.lines.flatMap((l) => l.stages) ?? [];
const kinds = (p: ReturnType<typeof plan>) => stagesOf(p).map((s) => `${s.kind}:${s.resource}`);

describe("one plan per visit", () => {
  it("has one arrival, one collection time and one line per service in the supplied order", () => {
    const p = plan([ceramic, ppf])!;
    expect(Object.keys(p).sort()).toEqual(["arrivalAt", "collectionEstimateAt", "lines"]);
    expect(p.arrivalAt).toBe(iso("09:00"));
    expect(p.lines.map((l) => l.serviceId)).toEqual(["ceramic", "ppf"]);
    expect(p.lines.map((l) => l.stages.map((s) => `${s.kind}:${s.resource}`))).toEqual([["main:protection"], ["main:protection"]]);
    expect(p.lines[0]!.stages[0]!.startAt).toBe(p.arrivalAt);
  });

  it("each line completes at the end of its main work; the collection time is the latest of them", () => {
    const p = plan([ceramic, ppf])!; // 300 then 480 minutes
    expect(p.lines.map((l) => l.estimatedCompletionAt)).toEqual([iso("14:00"), iso("22:00")]);
    expect(p.collectionEstimateAt).toBe(iso("22:00"));
  });
});

describe("collection estimate covers scheduled main work only", () => {
  it("PPF is 8 hours and Ceramic 5 hours of main work, with no preparation time added", () => {
    expect(plan([ppf])!.collectionEstimateAt).toBe(iso("17:00"));
    expect(plan([ceramic])!.collectionEstimateAt).toBe(iso("14:00"));
    expect(stagesOf(plan([ppf, ceramic]))).toHaveLength(2); // one scheduled stage per service, nothing for prep
  });
});

describe("bay categories come only from configuration", () => {
  it("each main stage uses its service's requiredBayType; changing the mapping changes the category", () => {
    expect(stagesOf(plan([garage]))[0]!.bayId).toMatch(/^gar-/);
    expect(stagesOf(plan([{ ...garage, requiredBayType: "protection" }]))[0]!.bayId).toMatch(/^ppf-/);
  });

  it("preparation is never scheduled: PPF, Ceramic and Detailing reserve only a PPF Bay, never a Wash or Garage Bay", () => {
    expect(kinds(plan([ppf, ceramic, detailing]))).toEqual(["main:protection", "main:protection", "main:protection"]);
    const washAndGarageBusy = busy(...["wash-1", "wash-2", "gar-1", "gar-2", "gar-3"].map((b) => reserved(b, "00:00", "23:59")));
    expect(plan([ppf], { occupancy: washAndGarageBusy })).not.toBeNull();
    expect(plan([ceramic], { occupancy: washAndGarageBusy })).not.toBeNull();
  });

  it("no fallback: with both PPF Bays busy there is no plan, even with every Wash and Garage Bay free", () => {
    expect(plan([ppf], { occupancy: busy(reserved("ppf-1", "08:00", "12:00"), reserved("ppf-2", "08:00", "12:00")) })).toBeNull();
  });

  it("no fallback: a Wash service with both Wash Bays busy gets no plan, even with other bays free", () => {
    expect(stagesOf(plan([wash]))[0]!.bayId).toMatch(/^wash-/);
    expect(plan([wash], { occupancy: busy(reserved("wash-1", "08:00", "12:00"), reserved("wash-2", "08:00", "12:00")) })).toBeNull();
  });

  it("a Garage service never uses Wash or PPF Bays", () => {
    const allButGarage = busy(...["wash-1", "wash-2", "ppf-1", "ppf-2"].map((b) => reserved(b, "00:00", "23:59")));
    expect(stagesOf(plan([garage], { occupancy: allButGarage }))[0]!.bayId).toMatch(/^gar-/);
    const garageBusy = busy(...["gar-1", "gar-2", "gar-3"].map((b) => reserved(b, "00:00", "23:59")));
    expect(plan([garage], { occupancy: garageBusy })).toBeNull();
  });

  it("rejects an unknown or non-customer bay type as a main stage", () => {
    expect(() => plan([{ ...garage, requiredBayType: "prep_wash" as never }])).toThrow(/unknown bay type/);
    expect(() => plan([{ ...garage, requiredBayType: "valet" as never }])).toThrow(/unknown bay type/);
  });
});

describe("shared PPF Bays and all-or-nothing planning", () => {
  it("Ceramic + PPF run one after the other, never overlapping; the timeline is the sum of the main work", () => {
    const all = stagesOf(plan([ceramic, ppf]));
    for (let i = 1; i < all.length; i++) expect(Date.parse(all[i]!.startAt)).toBeGreaterThanOrEqual(Date.parse(all[i - 1]!.endAt));
    expect(all.at(-1)!.endAt).toBe(iso("22:00")); // 300 + 480 minutes from 09:00
  });

  it("with one PPF Bay busy all day, both protection stages use the other PPF Bay", () => {
    const p = plan([ceramic, ppf], { occupancy: busy(reserved("ppf-1", "00:00", "23:59")) });
    expect(stagesOf(p).map((s) => s.bayId)).toEqual(["ppf-2", "ppf-2"]);
  });

  it("both PPF Bays busy only during the PPF stage: no plan at all, not the earlier stage", () => {
    const lateBusy = busy(reserved("ppf-1", "18:00", "20:00"), reserved("ppf-2", "18:00", "20:00"));
    expect(plan([ceramic], { occupancy: lateBusy })).not.toBeNull(); // the Ceramic part alone would fit
    expect(plan([ceramic, ppf], { occupancy: lateBusy })).toBeNull();
  });

  it("a last Garage stage that cannot be placed rejects the whole visit", () => {
    const garageBusy = busy(...["gar-1", "gar-2", "gar-3"].map((b) => reserved(b, "09:30", "12:00")));
    expect(plan([wash], { occupancy: garageBusy })).not.toBeNull();
    expect(plan([wash, garage], { occupancy: garageBusy })).toBeNull();
  });
});

describe("occupancy from S1a", () => {
  const held: OccupancyJob = { id: "held", bayId: "ppf-1", status: "IN_PROGRESS", scheduledAt: iso("08:00", "2027-01-01"), estimatedEndAt: iso("09:00", "2027-01-01") };

  it("a physical hold is a bay id with no interval, not a far-future window", () => {
    const conv = occupiedFromOccupancy(bayOccupancy([held]));
    expect([...conv.heldBayIds]).toEqual(["ppf-1"]);
    expect(conv.occupied.has("ppf-1")).toBe(false);
  });

  it("a held bay is never used, today or months later, even long after its estimate", () => {
    for (const day of ["2027-01-04", "2027-06-30"]) {
      const p = plan([ceramic, ppf], { day, occupancy: bayOccupancy([held]) });
      expect(stagesOf(p).map((s) => s.bayId)).toEqual(["ppf-2", "ppf-2"]);
    }
    expect(plan([ppf], { occupancy: bayOccupancy([held, { ...held, id: "held-2", bayId: "ppf-2" }]) })).toBeNull();
  });

  it("once the hold is gone from the occupancy (explicit release receipt), the bay is usable again", () => {
    const otherHeld: OccupancyJob = { ...held, id: "held-2", bayId: "ppf-2" };
    expect(plan([ppf], { occupancy: bayOccupancy([held, otherHeld]) })).toBeNull();
    const releasedJob: OccupancyJob = { ...held, status: "READY_FOR_DELIVERY", bayReleasedAt: iso("10:00", "2027-01-01"), bayReleasedBy: "staff-1" };
    const after = bayOccupancy([releasedJob, otherHeld]);
    expect([...occupiedFromOccupancy(after).heldBayIds]).toEqual(["ppf-2"]);
    expect(stagesOf(plan([ppf], { occupancy: after }))[0]!.bayId).toBe("ppf-1");
  });

  it("planned bookings keep the 15-minute turnover at the exact boundary", () => {
    const pending = (bayId: string, start: string, end: string): OccupancyJob => ({ id: `p-${bayId}-${start}`, bayId, status: "PENDING_VEHICLE", scheduledAt: iso(start), estimatedEndAt: iso(end) });
    const next = (start: string) => bayOccupancy([pending("wash-1", start, "11:00"), pending("wash-2", start, "11:00")]);
    expect(plan([wash], { occupancy: next("09:45") })).not.toBeNull(); // 09:00 + 30 + 15 = 09:45
    expect(plan([wash], { occupancy: next("09:40") })).toBeNull();
    const previous = (end: string) => bayOccupancy([pending("wash-1", "08:00", end), pending("wash-2", "08:00", end)]);
    expect(plan([wash], { occupancy: previous("08:45") })).not.toBeNull(); // 08:45 + 15 = 09:00
    expect(plan([wash], { occupancy: previous("08:50") })).toBeNull();
  });

  it("an invalid planned window throws instead of silently not blocking", () => {
    const bad: BayOccupancy = { planned: [{ bayId: "ppf-1", jobId: "j", interval: { startMs: Number.NaN, endMs: at("10:00").getTime() } }], holds: [] };
    expect(() => occupiedFromOccupancy(bad)).toThrow(/Invalid planned window/);
  });
});

describe("explicit execution order", () => {
  it("rejects an order that leaves out, repeats or names an unknown service, and a service listed twice", () => {
    expect(() => plan([wash, garage], { order: ["wash"] })).toThrow(/leaves out/);
    expect(() => plan([wash, garage], { order: ["wash", "ac", "wash"] })).toThrow(/repeats/);
    expect(() => plan([wash, garage], { order: ["wash", "tint"] })).toThrow(/unknown service/);
    expect(() => plan([wash, wash], { order: ["wash"] })).toThrow(/more than once/);
    expect(() => plan([], { order: [] })).toThrow(/at least one/);
  });

  it("follows the supplied order exactly, without grouping or sorting by bay category", () => {
    const a = plan([wash, garage, ppf], { order: ["ac", "wash", "ppf"] })!;
    expect(a.lines.map((l) => l.serviceId)).toEqual(["ac", "wash", "ppf"]);
    expect(kinds(a)).toEqual(["main:general", "main:wash", "main:protection"]);
    expect(kinds(plan([wash, garage, ppf], { order: ["ppf", "ac", "wash"] }))).toEqual(["main:protection", "main:general", "main:wash"]);
  });
});

describe("fixed turnover and explicit timing inputs", () => {
  it("every stage blocks until its end plus 15 minutes; a stray turnover value on a record is ignored", () => {
    expect(TURNOVER_BUFFER_MINUTES).toBe(15);
    const p = plan([{ ...garage, turnoverMinutes: 0 } as Svc, ceramic]);
    expect(stagesOf(p)).toHaveLength(2);
    for (const s of stagesOf(p)) expect(Date.parse(s.blockedUntil) - Date.parse(s.endAt)).toBe(15 * 60000);
  });

  it("requires valid transfer minutes and arrival time; a supplied transfer separates the stages", () => {
    expect(() => plan([ppf], { transferMinutes: -1 })).toThrow(/transferMinutes/);
    expect(() => plan([ppf], { transferMinutes: 2.5 })).toThrow(/transferMinutes/);
    expect(() => planVisit({ arrivalAt: new Date("nope"), services: [ppf], order: ["ppf"], bays: BAYS, occupancy: EMPTY, workEnd: plain, transferMinutes: 0 })).toThrow(/arrival/);
    expect(stagesOf(plan([wash, ppf], { transferMinutes: 10 }))[1]!.startAt).toBe(iso("09:40")); // 30 wash + 10 transfer
  });
});

describe("collection estimate of an existing plan", () => {
  it("reads the latest completion among retained lines without replanning or changing the plan", () => {
    const p = plan([garage, ceramic, ppf])!; // 09:00-09:45, 09:45-14:45, 14:45-22:45
    const before = JSON.parse(JSON.stringify(p));
    expect(p.collectionEstimateAt).toBe(iso("22:45"));
    expect(visitCollectionEstimate(p, ["ppf"])).toBe(iso("14:45"));
    expect(visitCollectionEstimate(p, ["ceramic"])).toBe(iso("22:45")); // PPF is not moved earlier
    expect(visitCollectionEstimate(p, [])).toBe(p.collectionEstimateAt);
    expect(visitCollectionEstimate(p, ["ac", "ceramic", "ppf"])).toBeNull();
    expect(() => visitCollectionEstimate(p, ["tint"])).toThrow(/not in this plan/);
    expect(p).toEqual(before);
  });
});

describe("duplicate wash", () => {
  it("detects a standalone Wash next to a service whose staff-managed workflow includes a wash; plans both, adds no stage", () => {
    expect(duplicateWash([wash, ppf])).toMatchObject({ standaloneWashIds: ["wash"], includingServiceIds: ["ppf"] });
    const p = plan([wash, ppf])!;
    expect(p.lines.map((l) => l.serviceId)).toEqual(["wash", "ppf"]); // nothing removed silently
    expect(kinds(p)).toEqual(["main:wash", "main:protection"]);
  });
});

describe("replanning an arrived vehicle", () => {
  const own: OccupancyJob = { id: "own", bayId: "ppf-1", status: "IN_PROGRESS", scheduledAt: iso("08:00"), estimatedEndAt: iso("09:00") };
  const other: OccupancyJob = { id: "other", bayId: "ppf-2", status: "IN_PROGRESS", scheduledAt: iso("08:00"), estimatedEndAt: iso("09:00") };
  const replan = (occupancy: BayOccupancy, jobIds: string[] | null) => planVisit({
    arrivalAt: at("09:00"), services: [ceramic], order: ["ceramic"], bays: BAYS, occupancy, workEnd: plain, transferMinutes: 0,
    ...(jobIds ? { replanning: { jobIds } } : {}),
  });

  it("without the replanning option the car's own hold excludes its bay (new-visit semantics)", () => {
    expect(stagesOf(replan(bayOccupancy([own]), null)).map((s) => s.bayId)).toEqual(["ppf-2"]);
    expect(replan(bayOccupancy([own, other]), null)).toBeNull();
  });

  it("with it, the car keeps its own held bay; other cars' holds still exclude theirs", () => {
    expect(stagesOf(replan(bayOccupancy([own]), ["own"])).map((s) => s.bayId)).toEqual(["ppf-1"]);
    expect(stagesOf(replan(bayOccupancy([own, other]), ["own"])).map((s) => s.bayId)).toEqual(["ppf-1"]);
    expect(replan(bayOccupancy([own, other]), ["someone-else"])).toBeNull();
  });

  it("the visit's own planned reservations do not block it; other planned reservations still do", () => {
    const ownPending: OccupancyJob = { id: "own-next", bayId: "ppf-1", status: "PENDING_VEHICLE", scheduledAt: iso("09:00"), estimatedEndAt: iso("14:00") };
    expect(stagesOf(replan(bayOccupancy([own, other, ownPending]), ["own", "own-next"])).map((s) => s.bayId)).toEqual(["ppf-1"]);
    const blocker = bayOccupancy([own, other, { ...ownPending, id: "someone-else" }]);
    expect(replan(blocker, ["own"])).toBeNull();
  });

  it("a car recorded in two bays is a location conflict and throws", () => {
    expect(() => replan(bayOccupancy([own, { ...other, id: "own-2" }]), ["own", "own-2"])).toThrow(/more than one bay/);
  });
});
