import { nextDue, lastFinishedJob, finishedAt, type DueService, type FinishedJob } from "./care-due";

/** The one due chip on a car in Garage: "Interior clean due in 12 d" or "Wash overdue 5 d". Null when nothing is due yet. Built from delivered visits only. */
export function dueChip(jobs: Array<FinishedJob & { vehicleId?: string }>, vehicleId: string, services: Record<string, DueService>, now = Date.now()): string | null {
  const d = nextDue(jobs.filter((j) => j.vehicleId === vehicleId), services, now);
  if (!d) return null;
  const days = Math.round((d.dueAt.getTime() - now) / 86_400_000);
  if (days < 0) return `${d.label} overdue ${-days} d`;
  if (days === 0) return `${d.label} due today`;
  return `${d.label} due in ${days} d`;
}

/** "12 Oct 2026 · Detail SPA" from the newest DELIVERED job on this car only. Null when there is none: no date is ever invented. */
export function lastServiceLine(jobs: Array<FinishedJob & { vehicleId?: string }>, vehicleId: string, services: Record<string, { name: string }>): string | null {
  const j = lastFinishedJob(jobs.filter((x) => x.vehicleId === vehicleId));
  const at = j ? finishedAt(j) : null;
  if (!j || !at || Number.isNaN(at.getTime())) return null;
  const ist = new Date(at.getTime() + 19_800_000);
  const date = `${ist.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
  const name = services[j.serviceId]?.name;
  return name ? `${date} \u00b7 ${name}` : date;
}
