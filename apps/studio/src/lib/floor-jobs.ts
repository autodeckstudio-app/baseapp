import type { ServiceJob } from "@autodeck/core";

/** Statuses where the car is physically in the studio (or on its way) and the job is not finished. */
export const OPEN_FLOOR_STATUSES = ["PENDING_VEHICLE", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"] as const;

/**
 * Jobs for one studio day: those scheduled in the span window that still run through `date`, plus
 * (only when viewing today or earlier) every still-open job regardless of its scheduled/estimated
 * date. Without the carry-over, a car that is still in the studio after its estimated end (an
 * overrunning job, or a ready-for-pickup car waiting days) disappears from the floor while Admin
 * still lists it.
 */
export function mergeFloorJobs(windowJobs: ServiceJob[], openJobs: ServiceJob[], date: string, includeCarryOver: boolean): ServiceJob[] {
  const byId = new Map<string, ServiceJob>();
  for (const j of windowJobs) if (j.estimatedEndDate >= date) byId.set(j.id, j);
  if (includeCarryOver) {
    for (const j of openJobs) {
      if ((OPEN_FLOOR_STATUSES as readonly string[]).includes(j.status)) byId.set(j.id, j);
    }
  }
  return [...byId.values()].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
