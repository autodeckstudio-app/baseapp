import { jobHoldsBay } from "@autodeck/core";
import type { ServiceJob } from "@autodeck/core";

export interface BayOccupancy {
  /** Jobs to show for the bay, ordered by scheduled start then id. */
  jobs: ServiceJob[];
  /** True when more than one car that has actually arrived holds the bay. */
  conflict: boolean;
}

/**
 * Display only: never picks a winner and never closes or moves a job.
 * A car that has arrived (anything but PENDING_VEHICLE) is what occupies a bay,
 * so a later booking still waiting for its car is not shown as a second car.
 * With no arrived car, the waiting booking is shown as before.
 */
export function bayOccupancy(jobs: ServiceJob[], bayId: string, now: number = Date.now()): BayOccupancy {
  const holders = jobs.filter((j) => j.bayId === bayId && jobHoldsBay(j, now));
  const arrived = holders.filter((j) => j.status !== "PENDING_VEHICLE");
  const shown = (arrived.length > 0 ? arrived : holders.slice(0, 1)).slice().sort((a, b) =>
    a.scheduledAt < b.scheduledAt ? -1 : a.scheduledAt > b.scheduledAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  return { jobs: shown, conflict: arrived.length > 1 };
}
