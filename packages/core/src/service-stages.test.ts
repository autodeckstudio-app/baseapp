import { describe, expect, it } from "vitest";
import {
  cartStages, duplicateWash, planStages, serviceStages, shouldAskDuplicateWash, withoutStandaloneWash,
  DUPLICATE_WASH_PROMPT, type Interval, type PlanBay, type StageService,
} from "./service-stages.js";
import type { Service } from "./types/service.js";
import { visitScheduleProblem } from "./visit-schedule.js";

// Fixtures only: durations here are test values, not proposed catalogue configuration.
const BAYS: PlanBay[] = [
  { id: "wash-1", bayType: "wash", active: true }, { id: "wash-2", bayType: "wash", active: true },
  { id: "det-1", bayType: "protection", active: true }, { id: "det-2", bayType: "protection", active: true },
  { id: "gar-1", bayType: "general", active: true }, { id: "gar-2", bayType: "general", active: true },
];
// Preparation is staff-managed and never scheduled; includesExteriorWash only drives the duplicate-wash prompt.
type Svc = StageService & Pick<Service, "standaloneExteriorWash" | "includesExteriorWash">;
const wash: Svc = { id: "wash", name: "Regular Wash", requiredBayType: "wash", estimatedDurationMinutes: 30, standaloneExteriorWash: true };
const ppf: Svc = { id: "ppf", name: "PPF", requiredBayType: "protection", estimatedDurationMinutes: 180, includesExteriorWash: true };
const extDetail: Svc = { id: "ext", name: "Exterior Detailing", requiredBayType: "protection", estimatedDurationMinutes: 120, includesExteriorWash: true };
const tint: StageService = { id: "tint", name: "Window Tint", requiredBayType: "protection", estimatedDurationMinutes: 180 };
const garage: StageService = { id: "ac", name: "AC check", requiredBayType: "general", estimatedDurationMinutes: 45 };
const policy = { mainResourceOrder: ["wash", "protection", "general"] as const, defaultTurnoverMinutes: 15 };

const at = (hhmm: string) => new Date(`2026-12-01T${hhmm}:00Z`);
const plain = (start: Date, minutes: number) => new Date(start.getTime() + minutes * 60000);
const busy = (entries: Record<string, Array<[string, string]>>) =>
  new Map<string, Interval[]>(Object.entries(entries).map(([bay, list]) => [bay, list.map(([a, b]) => ({ startAt: at(a), endAt: at(b) }))]));
const plan = (services: StageService[], start: string, occupied = busy({}), transferMinutes = 0) =>
  planStages({ startAt: at(start), stages: cartStages(services, policy), bays: BAYS, occupied, workEnd: plain, transferMinutes });
const resources = (p: ReturnType<typeof plan>) => p?.map((s) => `${s.kind}:${s.resource}`);

describe("serviceStages", () => {
  it("a service is one main stage in its own bay type, exactly as today", () => {
    expect(serviceStages(garage, 15)).toEqual([expect.objectContaining({ kind: "main", resource: "general", minutes: 45, turnoverMinutes: 15 })]);
  });
  it("never adds a preparation stage, even for a service whose workflow includes a wash", () => {
    expect(serviceStages(ppf, 15)).toEqual([expect.objectContaining({ kind: "main", resource: "protection", minutes: 180 })]);
  });
  it("rejects non-positive or fractional durations", () => {
    expect(() => serviceStages({ ...ppf, estimatedDurationMinutes: 0 }, 15)).toThrow();
    expect(() => serviceStages({ ...garage, estimatedDurationMinutes: 1.5 }, 15)).toThrow();
  });
  it("uses the turnover the caller passes; a service cannot carry its own", () => {
    expect(serviceStages(garage, 15)[0]!.turnoverMinutes).toBe(15);
    expect(serviceStages({ ...garage, turnoverMinutes: 0 } as StageService, 15)[0]!.turnoverMinutes).toBe(15);
  });
  it("refuses a cart whose resource has no configured execution order", () => {
    expect(() => cartStages([garage], { mainResourceOrder: ["wash"], defaultTurnoverMinutes: 0 })).toThrow(/No execution order/);
  });
});

describe("planStages: scenarios", () => {
  it("A. PPF reserves only its main work in a detailing bay; preparation is staff-managed", () => {
    const p = plan([ppf], "10:00")!;
    expect(resources(p)).toEqual(["main:protection"]);
    expect(p[0]).toMatchObject({ startAt: at("10:00").toISOString(), endAt: at("13:00").toISOString() });
  });
  it("A. PPF never depends on Wash Bays: busy Wash Bays do not block it; busy detailing bays do", () => {
    expect(plan([ppf], "10:00", busy({ "wash-1": [["10:00", "11:00"]], "wash-2": [["10:30", "11:00"]] }))).not.toBeNull();
    expect(plan([ppf], "10:00", busy({ "det-1": [["10:00", "11:00"]], "det-2": [["12:00", "13:00"]] }))).toBeNull();
  });
  it("B. Exterior detailing reserves only a detailing bay, never a Wash Bay", () => {
    expect(resources(plan([extDetail], "09:00"))).toEqual(["main:protection"]);
    expect(plan([extDetail], "09:00", busy({ "wash-1": [["00:00", "23:00"]], "wash-2": [["00:00", "23:00"]] }))).not.toBeNull();
  });
  it("C. Garage only never touches wash or detailing bays", () => {
    const all = busy({ "wash-1": [["00:00", "23:00"]], "wash-2": [["00:00", "23:00"]], "det-1": [["00:00", "23:00"]], "det-2": [["00:00", "23:00"]] });
    expect(resources(plan([garage], "10:00", all))).toEqual(["main:general"]);
  });
  it("D. Wash + Garage needs both resources", () => {
    expect(resources(plan([garage, wash], "10:00"))).toEqual(["main:wash", "main:general"]);
    expect(plan([garage, wash], "10:00", busy({ "gar-1": [["10:00", "12:00"]], "gar-2": [["10:00", "12:00"]] }))).toBeNull();
  });
  it("E. Wash removed at checkout: only the PPF installation is scheduled", () => {
    const d = duplicateWash([wash, ppf])!;
    const kept = [wash, ppf].filter((s) => withoutStandaloneWash(["wash", "ppf"], d).includes(s.id));
    expect(resources(plan(kept, "10:00"))).toEqual(["main:protection"]);
  });
  it("E. Wash kept: the extra wash is real extra work in a customer Wash Bay, then the PPF installation", () => {
    const p = plan([wash, ppf], "10:00")!;
    expect(resources(p)).toEqual(["main:wash", "main:protection"]);
    expect(p.at(-1)!.endAt).toBe(at("13:30").toISOString()); // 30 + 180 minutes; no preparation time is scheduled
    expect(p[0]!.bayId).toMatch(/^wash-/);
    expect(p[1]!.bayId).toMatch(/^det-/);
  });
});

describe("planStages: capacity rules", () => {
  it("brief case: wash at 10:00, detailing needed next; one detailing bay booked from 10:30 still leaves the other", () => {
    expect(plan([wash, extDetail], "10:00", busy({ "det-1": [["10:30", "12:30"]] }))![1]!.bayId).toBe("det-2");
  });
  it("brief case: both detailing bays busy during the detailing interval -> start time not offered", () => {
    expect(plan([wash, extDetail], "10:00", busy({ "det-1": [["10:30", "12:30"]], "det-2": [["11:00", "13:00"]] }))).toBeNull();
  });
  it("checks the actual stage interval, not the appointment start: detailing busy only at 10:00 does not block", () => {
    expect(plan([wash, extDetail], "10:00", busy({ "det-1": [["09:00", "10:30"]], "det-2": [["09:00", "10:30"]] }))).not.toBeNull();
  });
  it("consecutive bookings: an interval ending exactly when a stage starts does not conflict", () => {
    expect(plan([wash], "10:00", busy({ "wash-1": [["09:00", "10:00"]], "wash-2": [["09:00", "10:00"]] }))).not.toBeNull();
  });
  it("turnover blocks the next car: the stage's own turnover must fit before the next booking", () => {
    expect(plan([wash], "10:00", busy({ "wash-1": [["10:40", "11:00"]], "wash-2": [["10:40", "11:00"]] }))).toBeNull(); // 30 + 15 > 40
  });
  it("never allocates another category's bay", () => {
    const onlyGarageFree = busy({ "wash-1": [["00:00", "23:00"]], "wash-2": [["00:00", "23:00"]] });
    expect(plan([wash], "10:00", onlyGarageFree)).toBeNull();
  });
  it("ignores inactive bays", () => {
    const bays = BAYS.map((b) => (b.id === "det-2" ? { ...b, active: false } : b));
    expect(planStages({ startAt: at("10:00"), stages: cartStages([tint], policy), bays, occupied: busy({ "det-1": [["10:00", "11:00"]] }), workEnd: plain, transferMinutes: 0 })).toBeNull();
  });
  it("two services on the same resource run back to back", () => {
    const p = plan([extDetail, tint], "09:00")!;
    expect(resources(p)).toEqual(["main:protection", "main:protection"]);
    expect(p[1]!.startAt).toBe(p[0]!.endAt);
  });
  it("initialBayId keeps the car in its current bay when it suits the first stage, and is ignored when it does not", () => {
    const start = { startAt: at("10:00"), bays: BAYS, occupied: busy({}), workEnd: plain, transferMinutes: 0 };
    expect(planStages({ ...start, stages: cartStages([ppf], policy), initialBayId: "det-2" })![0]!.bayId).toBe("det-2");
    expect(planStages({ ...start, stages: cartStages([ppf], policy), initialBayId: "wash-1" })![0]!.bayId).toMatch(/^det-/);
    expect(planStages({ ...start, stages: cartStages([ppf], policy), occupied: busy({ "det-2": [["10:00", "11:00"]] }), initialBayId: "det-2" })![0]!.bayId).toBe("det-1");
  });
  it("transfer minutes separate stages", () => {
    expect(plan([wash, ppf], "10:00", busy({}), 10)![1]!.startAt).toBe(at("10:40").toISOString()); // 30 + 10
  });
  it("every plan satisfies the visit rule: one car is never in two bays at once", () => {
    const p = plan([wash, ppf, garage], "08:00")!;
    expect(visitScheduleProblem(p.map((s, i) => ({ jobId: `j${i}`, bayId: s.bayId, requiredBayType: s.resource, bayType: s.resource, startAt: s.startAt, endAt: s.endAt })))).toBeNull();
  });
  it("multi-day work uses the injected working-time clock", () => {
    // Toy clock: 10:00-18:00 working day, rolls to 10:00 next day.
    const workEnd = (start: Date, minutes: number) => {
      let t = new Date(start), left = minutes;
      while (left > 0) {
        const close = new Date(t); close.setUTCHours(18, 0, 0, 0);
        const room = (close.getTime() - t.getTime()) / 60000;
        if (left <= room) return new Date(t.getTime() + left * 60000);
        left -= room; t = new Date(close); t.setUTCDate(t.getUTCDate() + 1); t.setUTCHours(10, 0, 0, 0);
      }
      return t;
    };
    const long = { ...ppf, estimatedDurationMinutes: 600 };
    const p = planStages({ startAt: at("10:00"), stages: cartStages([long], policy), bays: BAYS, occupied: busy({}), workEnd, transferMinutes: 0 })!;
    expect(p[0]!.endAt).toBe("2026-12-02T12:00:00.000Z"); // 10:00 + 480 min to 18:00, then 120 min next day
  });
});

describe("duplicate-wash confirmation", () => {
  it("fires for a standalone wash next to a service that includes a wash", () => {
    expect(duplicateWash([wash, extDetail, ppf])).toMatchObject({ standaloneWashIds: ["wash"], includingServiceIds: ["ext", "ppf"] });
  });
  it("does not fire for Window Tint, which is not configured to include a wash", () => {
    expect(duplicateWash([wash, tint])).toBeNull();
  });
  it("does not fire without a standalone wash", () => {
    expect(duplicateWash([ppf, extDetail])).toBeNull();
  });
  it("asks once per cart state and again after the cart changes", () => {
    const d = duplicateWash([wash, ppf]);
    expect(shouldAskDuplicateWash(d, null)).toBe(true);
    expect(shouldAskDuplicateWash(d, d!.key)).toBe(false);
    expect(shouldAskDuplicateWash(duplicateWash([wash, ppf, extDetail]), d!.key)).toBe(true);
  });
  it("a standalone wash never counts as including a wash, so it cannot duplicate itself", () => {
    expect(duplicateWash([{ ...wash, includesExteriorWash: true }])).toBeNull();
    expect(duplicateWash([{ ...wash, includesExteriorWash: true }, ppf])).toMatchObject({ standaloneWashIds: ["wash"], includingServiceIds: ["ppf"] });
  });
  it("the key ignores cart order", () => {
    expect(duplicateWash([ppf, wash])!.key).toBe(duplicateWash([wash, ppf])!.key);
  });
  it("uses the exact approved wording", () => {
    expect(DUPLICATE_WASH_PROMPT.body).toBe("Wash is already included in one or more of your selected services. You have also added a separate Wash. Would you like to remove the additional Wash from your cart?");
    expect([DUPLICATE_WASH_PROMPT.remove, DUPLICATE_WASH_PROMPT.keep]).toEqual(["Yes, remove extra Wash", "No, keep Wash"]);
  });
});
