// When a car is next due. Intervals are the user's rule: coatings get a maintenance coat at 8 months,
// everything else uses market-standard gaps. Pure functions, no screens.
export interface DueService { id: string; name: string; category: string }
export interface FinishedJob { serviceId: string; status: string; sealedAt?: string | null; createdAt: string }

const DAY = 86_400_000;

/** Months for coatings, days for the rest. null means no due date (quotes, mods, pickup). */
export function dueRule(s: DueService): { days: number; label: string } | null {
  const n = s.name.toLowerCase();
  if (s.category === "ceramic" || s.category === "coating") return { days: 8 * 30, label: "Maintenance coat" };
  if (s.category === "ppf") return { days: 365, label: "PPF check" };
  if (s.category === "washing") return /interior/.test(n) ? { days: 90, label: "Interior clean" } : /detail/.test(n) ? { days: 60, label: "Detail wash" } : { days: 30, label: "Wash" };
  if (s.category === "garage" || s.category === "inspection") {
    if (/alignment/.test(n)) return { days: 180, label: "Alignment check" };
    if (/battery/.test(n)) return { days: 180, label: "Battery check" };
    if (/\bac\b/.test(n)) return { days: 365, label: "AC check" };
    if (/inspection/.test(n)) return { days: 180, label: "Inspection" };
  }
  return null;
}

/** Only a delivered visit counts as service history. Cancelled and in-flight jobs do not. */
export function finishedAt(j: FinishedJob): Date | null {
  return j.status === "DELIVERED" ? new Date(j.sealedAt ?? j.createdAt) : null;
}
export function lastFinishedJob<J extends FinishedJob>(jobs: J[]): J | null {
  const done = jobs.filter((j) => finishedAt(j) !== null);
  done.sort((a, b) => (finishedAt(b)!.getTime() - finishedAt(a)!.getTime()));
  return done[0] ?? null;
}

/** The soonest thing due for this car, from the latest delivered visit of each service. */
export function nextDue(jobs: FinishedJob[], services: Record<string, DueService>, now = Date.now()): { service: DueService; label: string; dueAt: Date; overdueDays: number } | null {
  const latest = new Map<string, Date>();
  for (const j of jobs) { const d = finishedAt(j); if (d && (!latest.has(j.serviceId) || d > latest.get(j.serviceId)!)) latest.set(j.serviceId, d); }
  let best: { service: DueService; label: string; dueAt: Date; overdueDays: number } | null = null;
  for (const [id, d] of latest) {
    const svc = services[id]; const rule = svc ? dueRule(svc) : null;
    if (!svc || !rule) continue;
    const dueAt = new Date(d.getTime() + rule.days * DAY);
    if (!best || dueAt < best.dueAt) best = { service: svc, label: rule.label, dueAt, overdueDays: Math.max(0, Math.floor((now - dueAt.getTime()) / DAY)) };
  }
  return best;
}
