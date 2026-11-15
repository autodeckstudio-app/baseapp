import { nextDue, type DueService, type FinishedJob } from "./care-due";

export const NEEDS_LEAD_DAYS = 7;
export type CarNeed = { serviceId: string; title: string; detail: string };

/** The one thing this car is due for, shown on Home only when overdue or due within a week. Built from delivered visits only. */
export function carNeed(jobs: FinishedJob[], services: Record<string, DueService>, now = Date.now()): CarNeed | null {
  const d = nextDue(jobs, services, now);
  if (!d) return null;
  const days = Math.ceil((d.dueAt.getTime() - now) / 86_400_000);
  if (days > NEEDS_LEAD_DAYS) return null;
  const detail = days < 0 ? `${d.service.name}, ${d.overdueDays} day${d.overdueDays === 1 ? "" : "s"} past due.` : days === 0 ? "Due today." : `Due in ${days} day${days === 1 ? "" : "s"}.`;
  return { serviceId: d.service.id, title: `${d.label} due`, detail };
}
