import type { ServiceJob } from "@autodeck/core";

/** Statuses where the car is physically in the studio (or on its way) and the job is not finished. */
export const OPEN_FLOOR_STATUSES = ["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"] as const;

/**
 * Jobs for one studio day: those scheduled in the span window that still run through `date`, plus
 * (only when viewing today or earlier) every still-open job scheduled on or before `date` regardless of its scheduled/estimated
 * date. Without the carry-over, a car that is still in the studio after its estimated end (an
 * overrunning job, or a ready-for-pickup car waiting days) disappears from the floor while Admin
 * still lists it.
 */
/** IST calendar date (YYYY-MM-DD) on which a DELIVERED/CANCELLED job was closed, from its last status-history entry; null if open or unknown. */
export function closedOnDate(j: ServiceJob): string | null {
  if (j.status !== "DELIVERED" && j.status !== "CANCELLED") return null;
  const last = j.statusHistory?.[j.statusHistory.length - 1];
  const t = last ? Date.parse(last.changedAt) : NaN;
  return Number.isFinite(t) ? new Date(t + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : null;
}

export function mergeFloorJobs(windowJobs: ServiceJob[], openJobs: ServiceJob[], date: string, includeCarryOver: boolean): ServiceJob[] {
  const byId = new Map<string, ServiceJob>();
  // A job delivered or cancelled on `date` stays in that day's Done/Cancelled history even if its estimate ended earlier (Admin lists it).
  for (const j of windowJobs) if (j.estimatedEndDate >= date || closedOnDate(j) === date) byId.set(j.id, j);
  if (includeCarryOver) {
    for (const j of openJobs) {
      // Never pull in future-dated jobs (tomorrow's bookings already hold a bay at booking time).
      if (j.scheduledDate > date) continue;
      if ((OPEN_FLOOR_STATUSES as readonly string[]).includes(j.status)) byId.set(j.id, j);
    }
  }
  return [...byId.values()].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
