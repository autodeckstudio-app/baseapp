import type { ServiceJob } from "@autodeck/core";

/** Every status a job holds while it is still open (not DELIVERED or CANCELLED). These are read in full (equality
 *  filters only) alongside the newest-300 feed, so an old job stuck open is not cut off. */
export const OPEN_JOB_STATUSES = ["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"] as const;

/** Union by id (the open-status copy and the newest copy are the same document), newest first. */
export function mergeJobFeeds(recent: ServiceJob[], openByStatus: ServiceJob[][]): ServiceJob[] {
  const byId = new Map<string, ServiceJob>();
  for (const j of recent) byId.set(j.id, j);
  for (const list of openByStatus) for (const j of list) byId.set(j.id, j);
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
