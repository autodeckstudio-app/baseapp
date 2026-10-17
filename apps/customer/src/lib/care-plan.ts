import { dueRule, finishedAt, type DueService, type FinishedJob } from "./care-due";

// Care plan for one car: what was done, what is due when, warranty ends, next maintenance coat.
// Pure. Due dates come from care-due's rules (coatings 8 months); nothing is invented.
const DAY = 86_400_000;

export type PlanJob = FinishedJob & { id?: string };
export type PlanWarranty = { label: string; endDate: string | null };

export type CarePlan = {
  done: Array<{ name: string; at: Date }>;
  due: Array<{ name: string; label: string; dueAt: Date; days: number }>;
  nextCoat: { name: string; dueAt: Date; days: number } | null;
  warranties: Array<{ label: string; endDate: string; days: number }>;
};

export function buildCarePlan(input: { jobs: PlanJob[]; services: Record<string, DueService>; warranties: PlanWarranty[]; now?: number }): CarePlan {
  const now = input.now ?? Date.now();
  const done: CarePlan["done"] = [];
  const latest = new Map<string, Date>();
  for (const j of input.jobs) {
    const at = finishedAt(j);
    const svc = input.services[j.serviceId];
    if (!at || !svc) continue;
    done.push({ name: svc.name, at });
    if (!latest.has(j.serviceId) || at > latest.get(j.serviceId)!) latest.set(j.serviceId, at);
  }
  done.sort((a, b) => b.at.getTime() - a.at.getTime());
  const due: CarePlan["due"] = [];
  let nextCoat: CarePlan["nextCoat"] = null;
  for (const [id, at] of latest) {
    const svc = input.services[id]!;
    const rule = dueRule(svc);
    if (!rule) continue;
    const dueAt = new Date(at.getTime() + rule.days * DAY);
    const days = Math.round((dueAt.getTime() - now) / DAY);
    due.push({ name: svc.name, label: rule.label, dueAt, days });
    if ((svc.category === "ceramic" || svc.category === "coating") && (!nextCoat || dueAt < nextCoat.dueAt)) nextCoat = { name: svc.name, dueAt, days };
  }
  due.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const warranties: CarePlan["warranties"] = [];
  for (const w of input.warranties) {
    if (!w.endDate) continue;
    const t = Date.parse(w.endDate);
    if (Number.isNaN(t)) continue;
    warranties.push({ label: w.label, endDate: w.endDate, days: Math.round((t - now) / DAY) });
  }
  warranties.sort((a, b) => a.days - b.days);
  return { done, due, nextCoat, warranties };
}

/** "Due in 12 days", "Due today", "Overdue by 5 days". */
export function dueText(days: number): string {
  if (days === 0) return "Due today";
  if (days > 0) return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
  return days === -1 ? "Overdue by 1 day" : `Overdue by ${-days} days`;
}
