// Pure bay-occupancy logic (scheduling stage S1a). No Firestore, no clock, no allocation:
// callers pass job data and times. Nothing in the app calls this module yet.
//
// Two independent facts are modelled and never mixed:
//  1. Planned reservations: a booked job whose vehicle has not arrived occupies its bay for
//     [scheduledAt, estimatedEndAt + TURNOVER_BUFFER_MINUTES) - the existing 15-minute turnover rule.
//  2. Physical holds: a vehicle recorded in a bay holds that bay until staff record an explicit release
//     receipt, honoured only in READY_FOR_DELIVERY or DELIVERED. estimatedEndAt is never consulted for a
//     hold, so a revised or overrun estimate can never free it.
//
// Known limitations (no new fields are read; pinned by the "known limitations" tests):
//  - A hold sits at the job's currently recorded bayId. A changed bayId is NOT proof of a physical move,
//    and the job record keeps no previous bay, so this module cannot keep the previous bay held. A bay
//    with no hold here means "no recorded occupancy", never "physically empty".
//  - A pause record (visitBayPause) never releases a bay by itself. Only a cleared bayId removes the hold;
//    production clears it when it records a move (moveVisitBay writes bayId '' with the pause).
//  - A vehicle cancelled while in a bay is held only when heldAfterCancelAt is set. Production does not
//    write that field yet, so such a vehicle is not detected. A receipt does not release it (S5).
//  - An unknown status throws instead of being treated as unoccupied.
import { TURNOVER_BUFFER_MINUTES } from "./constants.js";
import type { JobStatus } from "./types/index.js";

const MINUTE_MS = 60_000;

/** Start-inclusive, end-exclusive interval in epoch milliseconds. */
export interface OccupancyInterval {
  startMs: number;
  endMs: number;
}

/** The job fields this module reads. Optional fields are typed `unknown` because stored data may be malformed. */
export interface OccupancyJob {
  id: string;
  /** Bay the vehicle is assigned to or physically in; empty string when not in a bay (e.g. STANDBY). */
  bayId: string;
  status: string;
  scheduledAt: string;
  estimatedEndAt: string;
  statusHistory?: ReadonlyArray<{ status: string; changedAt: string }>;
  arrivedAt?: unknown;
  heldAfterCancelAt?: unknown;
  /** Accepted so callers can pass whole job records. Never used to release a bay (see known limitations). */
  visitBayPause?: unknown;
  bayReleasedAt?: unknown;
  bayReleasedBy?: unknown;
}

export interface PlannedReservation {
  bayId: string;
  jobId: string;
  interval: OccupancyInterval;
}

export interface PhysicalHold {
  bayId: string;
  jobId: string;
  /** When the vehicle arrived, if recorded. A hold has no end time. */
  sinceMs: number | null;
}

export interface BayOccupancy {
  planned: PlannedReservation[];
  holds: PhysicalHold[];
}

/** Statuses in which a vehicle with a bay is physically present. DELIVERED stays present until an explicit
 *  release receipt: changing the status alone is not treated as a physical release. */
const PRESENT_STATUSES: ReadonlySet<string> = new Set([
  "VEHICLE_RECEIVED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
  "DELIVERED",
]);

/** The only statuses in which a release receipt is honoured: production writes receipts only on
 *  READY_FOR_DELIVERY jobs, which can only advance to DELIVERED. */
const RECEIPT_STATUSES: ReadonlySet<string> = new Set(["READY_FOR_DELIVERY", "DELIVERED"]);

/** Every JobStatus. Typed as a Record so a new status added to JobStatus fails to compile here until it is
 *  classified. */
const KNOWN_STATUSES: Record<JobStatus, true> = {
  PENDING_VEHICLE: true,
  STANDBY: true,
  VEHICLE_RECEIVED: true,
  IN_PROGRESS: true,
  QUALITY_CHECK: true,
  READY_FOR_DELIVERY: true,
  DELIVERED: true,
  CANCELLED: true,
};

function assertKnownStatus(status: unknown): void {
  if (typeof status !== "string" || !Object.prototype.hasOwnProperty.call(KNOWN_STATUSES, status)) {
    throw new RangeError(`Unknown job status: ${String(status)}`);
  }
}

function parseIsoStrict(value: unknown, label: string): number {
  const ms = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(ms)) throw new RangeError(`Invalid ${label}: ${String(value)}`);
  return ms;
}

/** Planned occupancy of a booked job: [scheduledAt, estimatedEndAt + turnover). Throws on invalid timestamps or
 *  an end before the start, so malformed data can never silently under-block a bay. */
export function plannedReservationInterval(scheduledAt: string, estimatedEndAt: string): OccupancyInterval {
  const startMs = parseIsoStrict(scheduledAt, "scheduledAt");
  const rawEndMs = parseIsoStrict(estimatedEndAt, "estimatedEndAt");
  if (rawEndMs < startMs) throw new RangeError(`estimatedEndAt ${estimatedEndAt} is before scheduledAt ${scheduledAt}`);
  return { startMs, endMs: rawEndMs + TURNOVER_BUFFER_MINUTES * MINUTE_MS };
}

/** Start-inclusive, end-exclusive overlap: an interval ending exactly when another starts does not overlap. */
export function plannedIntervalsOverlap(a: OccupancyInterval, b: OccupancyInterval): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/** Would a new piece of work [startMs, rawEndMs) conflict with existing planned intervals? The candidate also
 *  carries the turnover buffer - the same rule as the existing hasConflict in functions/src/lib/availability.ts. */
export function hasPlannedConflict(startMs: number, rawEndMs: number, occupied: readonly OccupancyInterval[]): boolean {
  const candidate: OccupancyInterval = { startMs, endMs: rawEndMs + TURNOVER_BUFFER_MINUTES * MINUTE_MS };
  return occupied.some((o) => plannedIntervalsOverlap(candidate, o));
}

/** Shape of an explicit release receipt, using the fields production writes (releaseCompletedBay /
 *  releaseVisitBay): bayReleasedAt = ISO string, bayReleasedBy = non-empty user id. Shape check only:
 *  isPhysicallyPresent honours a receipt only in READY_FOR_DELIVERY or DELIVERED. */
export function hasReleaseReceipt(job: Pick<OccupancyJob, "bayReleasedAt" | "bayReleasedBy">): boolean {
  const by = job.bayReleasedBy;
  const at = job.bayReleasedAt;
  return typeof by === "string" && by.length > 0 && typeof at === "string" && Number.isFinite(Date.parse(at));
}

/** Recorded as physically in its bay: has a recorded bay, and either is in a present status without a release
 *  receipt honoured for that status, or was cancelled while present (heldAfterCancelAt). A pause record is
 *  ignored; only a cleared bayId removes the hold. estimatedEndAt is not consulted. Throws on an unknown status. */
export function isPhysicallyPresent(job: OccupancyJob): boolean {
  assertKnownStatus(job.status);
  if (job.bayId.length === 0) return false;
  if (PRESENT_STATUSES.has(job.status)) return !(RECEIPT_STATUSES.has(job.status) && hasReleaseReceipt(job));
  return job.status === "CANCELLED" && typeof job.heldAfterCancelAt === "string" && job.heldAfterCancelAt.length > 0;
}

/** When the vehicle arrived: arrivedAt if recorded, otherwise the first VEHICLE_RECEIVED history entry. */
export function physicalHoldSince(job: Pick<OccupancyJob, "arrivedAt" | "statusHistory">): number | null {
  if (typeof job.arrivedAt === "string") {
    const ms = Date.parse(job.arrivedAt);
    if (Number.isFinite(ms)) return ms;
  }
  const arrival = (job.statusHistory ?? []).find((h) => h.status === "VEHICLE_RECEIVED");
  if (!arrival) return null;
  const ms = Date.parse(arrival.changedAt);
  return Number.isFinite(ms) ? ms : null;
}

/** Split jobs into the two independent occupancy facts. A physically present job contributes a hold only;
 *  a not-yet-arrived booked job contributes a planned reservation only. Throws on an unknown status. */
export function bayOccupancy(jobs: readonly OccupancyJob[]): BayOccupancy {
  const planned: PlannedReservation[] = [];
  const holds: PhysicalHold[] = [];
  for (const job of jobs) {
    if (isPhysicallyPresent(job)) {
      holds.push({ bayId: job.bayId, jobId: job.id, sinceMs: physicalHoldSince(job) });
    } else if (job.status === "PENDING_VEHICLE" && job.bayId.length > 0) {
      planned.push({ bayId: job.bayId, jobId: job.id, interval: plannedReservationInterval(job.scheduledAt, job.estimatedEndAt) });
    }
  }
  return { planned, holds };
}

/** True when the bay has no recorded occupancy for [startMs, rawEndMs): no recorded physical hold (at any time)
 *  and no overlap, with turnover, with that bay's planned reservations. Not proof the bay is physically empty:
 *  after an ID-only bay change the previous bay has no recorded hold (see known limitations). Pure predicate;
 *  nothing allocates with it yet. */
export function isBayFree(bayId: string, startMs: number, rawEndMs: number, occupancy: BayOccupancy): boolean {
  if (occupancy.holds.some((h) => h.bayId === bayId)) return false;
  const planned = occupancy.planned.filter((p) => p.bayId === bayId).map((p) => p.interval);
  return !hasPlannedConflict(startMs, rawEndMs, planned);
}

export interface ServiceCompletion {
  estimatedEndAt: string;
  /** False for a cancelled or removed service line; such lines never affect the collection estimate. */
  retained: boolean;
}

/** Collection estimate for a visit: the latest estimated completion among retained services, as an ISO string.
 *  Null when no service is retained. Throws on an invalid timestamp in a retained service. */
export function collectionEstimate(services: readonly ServiceCompletion[]): string | null {
  let latest: number | null = null;
  for (const s of services) {
    if (!s.retained) continue;
    const ms = parseIsoStrict(s.estimatedEndAt, "estimatedEndAt");
    if (latest === null || ms > latest) latest = ms;
  }
  return latest === null ? null : new Date(latest).toISOString();
}
