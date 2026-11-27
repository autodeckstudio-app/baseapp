// Service-stage scheduling: one customer start time -> an ordered, sequential plan of bay stages, one per bookable
// service. Pure: no Firebase, no clock. Intended for getAvailability (offer a start time only when a plan exists)
// and createBooking (re-plan inside the transaction). NOT wired into either yet.
//
// Application-managed vs staff-managed work:
// - The application schedules only each bookable service's MAIN work, in the bay type Admin maps it to
//   (requiredBayType), for its configured duration (estimatedDurationMinutes).
// - Preparation (for example the PPF/Ceramic prep wash) is staff-managed. Staff perform it in any suitable area.
//   It is not a stage, not a resource, and never reserves a Wash, PPF or Garage Bay. Collection estimates therefore
//   cover the scheduled main work only; staff update the estimate when operational work needs more time.
//
// Rules this module enforces by construction:
// - A stage only ever uses a bay of its own resource type. There is no cross-category fallback.
// - Stages run one after another, so one car is never in two bays at once (same rule as visit-schedule.ts).
// - Every stage must fit. When any stage has no free bay, the whole start time is rejected (no partial plan).
// - Intervals are start-inclusive and end-exclusive. Turnover is supplied by the caller; a service cannot carry
//   its own (visit planning always passes the existing TURNOVER_BUFFER_MINUTES).
import type { BayType, Service } from "./types/service.js";

/** Customer/staff labels for the stored bay types. The stored enum is unchanged (no migration). */
export const RESOURCE_LABEL: Readonly<Record<BayType, string>> = {
  wash: "Wash Bay",
  protection: "Detailing Bay",
  general: "Garage",
};

export interface Stage {
  serviceId: string;
  /** Always "main": the application schedules only bookable main work. Preparation is staff-managed, never a stage. */
  kind: "main";
  resource: BayType;
  minutes: number;
  turnoverMinutes: number;
  label: string;
}

export type StageService = Pick<Service, "id" | "name" | "requiredBayType" | "estimatedDurationMinutes">;

const positiveInt = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;
const nonNegativeInt = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/** The scheduled stages of one service: exactly one, its main work in its Admin-mapped bay type for its configured
 *  duration, with the caller's turnover. No preparation stage is ever added (preparation is staff-managed). */
export function serviceStages(s: StageService, turnoverMinutes: number): Stage[] {
  if (!nonNegativeInt(turnoverMinutes)) throw new Error(`Invalid turnover for ${s.id}`);
  if (!positiveInt(s.estimatedDurationMinutes)) throw new Error(`Invalid duration for ${s.id}`);
  return [{ serviceId: s.id, kind: "main", resource: s.requiredBayType, minutes: s.estimatedDurationMinutes, turnoverMinutes, label: s.name }];
}

export interface CartOrderPolicy {
  /** Services run grouped by the resource of their main stage, in this order. Required: the order is a business
   *  decision, never defaulted here. (Visit planning does not use this; it takes an explicit order.) */
  mainResourceOrder: readonly BayType[];
  defaultTurnoverMinutes: number;
}

/** All stages for a cart, in execution order. Services with the same main resource keep cart order. */
export function cartStages(services: readonly StageService[], policy: CartOrderPolicy): Stage[] {
  if (services.length === 0) return [];
  if (new Set(policy.mainResourceOrder).size !== policy.mainResourceOrder.length) throw new Error("Duplicate resource in order policy");
  const rank = (s: StageService) => {
    const i = policy.mainResourceOrder.indexOf(s.requiredBayType);
    if (i < 0) throw new Error(`No execution order for resource ${s.requiredBayType}`);
    return i;
  };
  return services
    .map((s, i) => ({ s, i, r: rank(s) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .flatMap(({ s }) => serviceStages(s, policy.defaultTurnoverMinutes));
}

export interface Interval { startAt: Date; endAt: Date }
export interface PlanBay { id: string; bayType: BayType; active: boolean }

export interface PlanInput {
  startAt: Date;
  stages: readonly Stage[];
  bays: readonly PlanBay[];
  /** Existing occupancy per bay. Each interval already includes the occupying job's own turnover. */
  occupied: ReadonlyMap<string, readonly Interval[]>;
  /** End of `minutes` of working time from `start` (opening-hours aware, e.g. computeScheduleEnd). */
  workEnd: (start: Date, minutes: number) => Date;
  /** Working minutes between consecutive stages (moving the car). 0 = the next stage starts as the last ends. */
  transferMinutes: number;
  /** Bay the car is already physically in (replanning an arrived vehicle). Preferred for the first stage when it is
   *  a candidate for that stage and free; otherwise ignored. Absent = no preference (unchanged behaviour). */
  initialBayId?: string;
}

export interface StageAllocation {
  serviceId: string;
  kind: "main";
  resource: BayType;
  label: string;
  bayId: string;
  startAt: string;
  /** Work complete. */
  endAt: string;
  /** Bay free for the next car (endAt + turnover). */
  blockedUntil: string;
}

const overlaps = (a: Interval, b: Interval) => a.startAt < b.endAt && b.startAt < a.endAt;

/** A full plan for this start time, or null when any stage cannot be placed. */
export function planStages(input: PlanInput): StageAllocation[] | null {
  const { stages, bays, occupied, workEnd } = input;
  if (stages.length === 0 || !nonNegativeInt(input.transferMinutes)) return null;
  const out: StageAllocation[] = [];
  let cursor = input.startAt;
  let previousBay: string | null = input.initialBayId ?? null;
  for (const [i, stage] of stages.entries()) {
    const start = i === 0 || input.transferMinutes === 0 ? cursor : workEnd(cursor, input.transferMinutes);
    const end = workEnd(start, stage.minutes);
    if (!(end > start)) return null;
    const blocked: Interval = { startAt: start, endAt: new Date(end.getTime() + stage.turnoverMinutes * 60000) };
    const candidates = bays.filter((b) => b.active && b.bayType === stage.resource);
    const free = candidates.filter((b) => !(occupied.get(b.id) ?? []).some((o) => overlaps(blocked, o)));
    if (free.length === 0) return null;
    // Keep the car in the bay it is already in when that bay suits the stage; otherwise the least-loaded bay.
    const bay = free.find((b) => b.id === previousBay)
      ?? [...free].sort((a, b) => (occupied.get(a.id)?.length ?? 0) - (occupied.get(b.id)?.length ?? 0))[0]!;
    out.push({ serviceId: stage.serviceId, kind: stage.kind, resource: stage.resource, label: stage.label, bayId: bay.id, startAt: start.toISOString(), endAt: end.toISOString(), blockedUntil: blocked.endAt.toISOString() });
    previousBay = bay.id;
    cursor = end;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Checkout duplicate-wash confirmation
// ---------------------------------------------------------------------------

export const DUPLICATE_WASH_PROMPT = {
  body: "Wash is already included in one or more of your selected services. You have also added a separate Wash. Would you like to remove the additional Wash from your cart?",
  remove: "Yes, remove extra Wash",
  keep: "No, keep Wash",
} as const;

export interface DuplicateWash {
  /** Separately added wash products the customer may remove. */
  standaloneWashIds: string[];
  /** Selected services whose own workflow already includes an exterior wash. */
  includingServiceIds: string[];
  /** Stable identity of the cart state this question is about. Ask once per key. */
  key: string;
}

/** Non-null only when a standalone wash sits next to a different service whose Admin flag says its own
 *  (staff-managed) workflow includes an exterior wash. Services without that flag (for example Window Tint) never
 *  trigger it. Resource-free: nothing here schedules, reserves or times any preparation. */
export function duplicateWash(services: readonly Pick<Service, "id" | "standaloneExteriorWash" | "includesExteriorWash">[]): DuplicateWash | null {
  const standaloneWashIds = services.filter((s) => s.standaloneExteriorWash === true).map((s) => s.id);
  const includingServiceIds = services.filter((s) => s.includesExteriorWash === true && s.standaloneExteriorWash !== true).map((s) => s.id);
  if (standaloneWashIds.length === 0 || includingServiceIds.length === 0) return null;
  return { standaloneWashIds, includingServiceIds, key: [...services.map((s) => s.id)].sort().join("|") };
}

/** Whether to show the prompt: there is a duplicate, and the customer has not answered for this exact cart. */
export function shouldAskDuplicateWash(d: DuplicateWash | null, answeredKey: string | null): boolean {
  return d !== null && d.key !== answeredKey;
}

/** "Yes, remove extra Wash": the cart without the standalone washes. The other services keep their own included,
 *  staff-managed wash. Only called after the customer chooses to remove; nothing is removed silently. */
export function withoutStandaloneWash(ids: readonly string[], d: DuplicateWash): string[] {
  return ids.filter((id) => !d.standaloneWashIds.includes(id));
}
