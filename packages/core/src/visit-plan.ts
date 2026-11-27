// Pure multi-service visit planning (scheduling stage S1b). No Firestore, no clock, no allocation writes, no
// prices, payments or gifts. Nothing in the app calls this module yet.
//
// One visit = one arrival time, one line per selected service, one collection estimate.
//
// Application-managed vs staff-managed work:
// - The application schedules each bookable service's MAIN work only: the bay type Admin maps it to
//   (requiredBayType) for its configured duration (estimatedDurationMinutes; for example PPF 8 h, Ceramic 5 h).
// - Preparation (for example the PPF/Ceramic prep wash) is staff-managed. Staff perform it in any suitable area;
//   the application does not reserve, allocate, display or time it, and it never consumes a Wash, PPF or Garage Bay.
// - The collection estimate therefore covers the scheduled main work only. No preparation time is added unless a
//   future approved stage configures it; staff update the estimate when operational work needs more time.
//
// Rules enforced here, on top of the existing service-stages primitives:
// - Bay categories come only from Admin configuration (requiredBayType). This module never chooses a category from
//   a service id, name or category. planStages matches bay types exactly: no fallback between categories.
// - The execution order is supplied by the caller and followed exactly. Nothing is sorted or defaulted here
//   (cartStages and its category grouping are not used).
// - Turnover is always the existing TURNOVER_BUFFER_MINUTES; a service cannot carry its own.
// - A bay with a physical hold (S1a) is excluded from every stage at any time; a hold has no end time.
// - All or nothing: if any stage cannot be placed, there is no plan.
// Invalid input or configuration throws; "no capacity at this arrival time" returns null.
// S1a's open limitations (an ID-only bay change; cancelled-after-arrival vehicles) carry into the occupancy input.
import { TURNOVER_BUFFER_MINUTES } from "./constants.js";
import { collectionEstimate, type BayOccupancy } from "./occupancy.js";
import {
  planStages,
  serviceStages,
  type Interval,
  type PlanBay,
  type Stage,
  type StageAllocation,
  type StageService,
} from "./service-stages.js";
import type { BayType } from "./types/index.js";

/** The Admin service fields visit planning reads: id, name, requiredBayType and estimatedDurationMinutes. */
export type VisitService = StageService;

const MAIN_RESOURCES: ReadonlySet<string> = new Set<BayType>(["wash", "protection", "general"]);

/** The services in exactly the caller's order. Throws on an empty cart, a service listed twice in the cart, or an
 *  order that repeats, names an unknown service or leaves one out. Never sorts and never supplies a default. */
export function orderVisitServices<S extends { id: string }>(services: readonly S[], order: readonly string[]): S[] {
  if (services.length === 0) throw new RangeError("A visit needs at least one service.");
  const byId = new Map<string, S>();
  for (const s of services) {
    if (byId.has(s.id)) throw new RangeError(`Service ${s.id} is in the cart more than once.`);
    byId.set(s.id, s);
  }
  if (new Set(order).size !== order.length) throw new RangeError("The execution order repeats a service.");
  for (const id of order) {
    if (!byId.has(id)) throw new RangeError(`The execution order names unknown service ${id}.`);
  }
  if (order.length !== byId.size) throw new RangeError("The execution order leaves out a selected service.");
  return order.map((id) => byId.get(id) as S);
}

/** Each service's scheduled stages (its main work only), one array per service in the given order. Validates the
 *  Admin bay type; never changes it. Preparation is staff-managed and is never added as a stage. */
export function visitStages(orderedServices: readonly VisitService[]): Stage[][] {
  return orderedServices.map((s) => {
    if (!MAIN_RESOURCES.has(s.requiredBayType)) {
      throw new RangeError(`Service ${s.id} has an unknown bay type: ${String(s.requiredBayType)}.`);
    }
    const stages = serviceStages(s, TURNOVER_BUFFER_MINUTES);
    if (stages.some((st) => st.turnoverMinutes !== TURNOVER_BUFFER_MINUTES)) {
      throw new RangeError(`Service ${s.id} does not use the ${TURNOVER_BUFFER_MINUTES}-minute turnover.`);
    }
    return stages;
  });
}

export interface PlanningOccupancy {
  /** Planned reservations only: finite windows that already include the occupying job's turnover. */
  occupied: ReadonlyMap<string, readonly Interval[]>;
  /** Bays with a physical hold. A hold has no end time, so these bays are excluded from every stage at any time. */
  heldBayIds: ReadonlySet<string>;
}

/** S1a occupancy in the form planning uses. A physical hold is never turned into an interval: planStages compares
 *  finite dates only (an "endless" Date is invalid and would silently not block), so holds are returned as bay ids
 *  and excluded from the candidate bays instead. Throws on a non-finite or reversed planned window.
 *  `ownJobIds` (replanning only): the visit's own jobs, whose reservations and hold are being replanned, so they
 *  neither block nor exclude anything. Every other job's reservations and holds still apply. */
export function occupiedFromOccupancy(occupancy: BayOccupancy, ownJobIds: ReadonlySet<string> = new Set()): PlanningOccupancy {
  const occupied = new Map<string, Interval[]>();
  for (const p of occupancy.planned) {
    if (ownJobIds.has(p.jobId)) continue;
    const { startMs, endMs } = p.interval;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      throw new RangeError(`Invalid planned window for job ${p.jobId}.`);
    }
    const list = occupied.get(p.bayId) ?? [];
    list.push({ startAt: new Date(startMs), endAt: new Date(endMs) });
    occupied.set(p.bayId, list);
  }
  return { occupied, heldBayIds: new Set(occupancy.holds.filter((h) => !ownJobIds.has(h.jobId)).map((h) => h.bayId)) };
}

export interface VisitPlanInput {
  /** The one vehicle arrival time for the whole visit; the first stage starts here. */
  arrivalAt: Date;
  services: readonly VisitService[];
  /** Execution order as service ids, supplied by the caller. Never defaulted or sorted here. */
  order: readonly string[];
  /** Studio bays (Wash, PPF, Garage) from configuration. Held bays are excluded automatically. */
  bays: readonly PlanBay[];
  occupancy: BayOccupancy;
  /** End of `minutes` of working time from `start` (opening-hours aware, e.g. computeScheduleEnd). */
  workEnd: (start: Date, minutes: number) => Date;
  /** Working minutes to move the car between consecutive stages. Required: this module has no default. */
  transferMinutes: number;
  /** Replanning an existing visit whose car may already be physically in a bay: the visit's own job ids. Their
   *  reservations and hold are being replanned, so they do not exclude the car's own bay, and the first stage prefers
   *  the bay the car is in. Other cars' holds still exclude their bays. Absent = planning a new visit. */
  replanning?: { jobIds: readonly string[] };
}

export interface VisitPlanLine {
  serviceId: string;
  name: string;
  /** This service's scheduled main work. Staff-managed preparation is never represented here. */
  stages: StageAllocation[];
  /** End of this service's scheduled main work. */
  estimatedCompletionAt: string;
}

export interface VisitPlan {
  arrivalAt: string;
  lines: VisitPlanLine[];
  /** Latest estimated completion among the lines: scheduled main work only, with no preparation time added.
   *  Staff update the estimate when operational work needs more time. */
  collectionEstimateAt: string;
}

/** One all-or-nothing plan for the whole visit, or null when any stage cannot be placed at this arrival time. */
export function planVisit(input: VisitPlanInput): VisitPlan | null {
  if (!Number.isFinite(input.arrivalAt.getTime())) throw new RangeError("Invalid arrival time.");
  if (!Number.isSafeInteger(input.transferMinutes) || input.transferMinutes < 0) {
    throw new RangeError("transferMinutes must be a non-negative whole number of minutes.");
  }
  const ordered = orderVisitServices(input.services, input.order);
  const perService = visitStages(ordered);
  const ownJobIds = new Set(input.replanning?.jobIds ?? []);
  const { occupied, heldBayIds } = occupiedFromOccupancy(input.occupancy, ownJobIds);
  const ownBays = [...new Set(input.occupancy.holds.filter((h) => ownJobIds.has(h.jobId)).map((h) => h.bayId))];
  if (ownBays.length > 1) throw new RangeError("The visit's car is recorded in more than one bay. Staff review is required.");
  const currentBayId = ownBays[0];
  const allocations = planStages({
    startAt: input.arrivalAt,
    stages: perService.flat(),
    bays: input.bays.filter((b) => !heldBayIds.has(b.id)),
    occupied,
    workEnd: input.workEnd,
    transferMinutes: input.transferMinutes,
    ...(currentBayId !== undefined ? { initialBayId: currentBayId } : {}),
  });
  if (allocations === null) return null;

  const lines: VisitPlanLine[] = [];
  let next = 0;
  ordered.forEach((s, i) => {
    const count = perService[i]?.length ?? 0;
    const stages = allocations.slice(next, next + count);
    next += count;
    const last = stages[stages.length - 1];
    if (!last || stages.length !== count) throw new Error(`Plan is missing stages for ${s.id}.`);
    lines.push({ serviceId: s.id, name: s.name, stages, estimatedCompletionAt: last.endAt });
  });
  const collectionEstimateAt = collectionEstimate(lines.map((l) => ({ estimatedEndAt: l.estimatedCompletionAt, retained: true })));
  if (collectionEstimateAt === null) throw new Error("A planned visit has no collection estimate.");
  return { arrivalAt: input.arrivalAt.toISOString(), lines, collectionEstimateAt };
}

/** Latest estimated completion among the retained lines of an EXISTING plan, at the times already planned.
 *  Read-only: it does not replan, move or reassign the remaining stages, release capacity, or apply any fee,
 *  refund or cancellation rule. Replanning after a cart change is a separate planVisit call. Null when no line is
 *  retained; throws on a removed id that is not in the plan. */
export function visitCollectionEstimate(plan: VisitPlan, removedServiceIds: readonly string[]): string | null {
  const inPlan = new Set(plan.lines.map((l) => l.serviceId));
  for (const id of removedServiceIds) {
    if (!inPlan.has(id)) throw new RangeError(`Service ${id} is not in this plan.`);
  }
  const removed = new Set(removedServiceIds);
  return collectionEstimate(plan.lines.map((l) => ({ estimatedEndAt: l.estimatedCompletionAt, retained: !removed.has(l.serviceId) })));
}
