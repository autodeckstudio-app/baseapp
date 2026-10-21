import { nextDue, type DueService, type FinishedJob } from "./care-due";

/** The one due chip on a car in Garage: "Interior clean due in 12 d" or "Wash overdue 5 d". Null when nothing is due yet. Built from delivered visits only. */
export function dueChip(jobs: Array<FinishedJob & { vehicleId?: string }>, vehicleId: string, services: Record<string, DueService>, now = Date.now()): string | null {
  const d = nextDue(jobs.filter((j) => j.vehicleId === vehicleId), services, now);
  if (!d) return null;
  const days = Math.round((d.dueAt.getTime() - now) / 86_400_000);
  if (days < 0) return `${d.label} overdue ${-days} d`;
  if (days === 0) return `${d.label} due today`;
  return `${d.label} due in ${days} d`;
}
