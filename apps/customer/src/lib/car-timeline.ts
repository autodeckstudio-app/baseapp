import type { CarePlan } from "./care-plan";
import { dueText } from "./care-plan";

// One timeline for a car: what is coming (care plan due, paper expiry, warranty end) in date order, then what was done, newest first.
// Pure. Every date comes from the care plan, papers, warranties or jobs; nothing is invented.
export const SOON_DAYS = 30;

export type TimelineItem = {
  key: string;
  /** Short date label above the title, upper case in the UI. */
  when: string;
  title: string;
  sub: string;
  /** Orange dot: due within SOON_DAYS or already past. */
  soon: boolean;
  /** Small status pill on the right. */
  pill?: string;
  /** Sort value: ms since epoch. */
  at: number;
};

const short = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function whenText(days: number, at: number): string {
  if (days < 0) return `OVERDUE, ${short(at)}`;
  if (days === 0) return "TODAY";
  if (days === 1) return "TOMORROW";
  if (days <= 60) return `IN ${days} DAYS`;
  return short(at).toUpperCase();
}

export function buildUpcoming(i: {
  plan: CarePlan;
  papers: Array<{ id: string; label: string; expiresOn: string | null; days: number | null }>;
  now?: number;
}): TimelineItem[] {
  const out: TimelineItem[] = [];
  i.plan.due.forEach((d, n) => out.push({
    key: `care-${n}`, when: whenText(d.days, d.dueAt.getTime()), title: d.label, sub: `Care plan, ${d.name}. ${dueText(d.days)}`,
    soon: d.days <= SOON_DAYS, at: d.dueAt.getTime(),
  }));
  for (const p of i.papers) {
    if (!p.expiresOn || p.days === null) continue;
    const at = Date.parse(`${p.expiresOn}T00:00:00+05:30`);
    out.push({
      key: `paper-${p.id}`, when: whenText(p.days, at), title: `${p.label} expires`, sub: p.days < 0 ? "Papers, upload the renewed copy" : "Papers, add the renewal when you have it",
      soon: p.days <= SOON_DAYS, ...(p.days <= SOON_DAYS ? { pill: p.days < 0 ? "Expired" : `${p.days} day${p.days === 1 ? "" : "s"}` } : {}), at,
    });
  }
  i.plan.warranties.forEach((w, n) => {
    const at = Date.parse(w.endDate);
    out.push({ key: `warranty-${n}`, when: whenText(w.days, at), title: `${w.label} ends`, sub: "Warranty", soon: w.days <= 60 && w.days >= 0 || w.days < 0, at });
  });
  return out.sort((a, b) => a.at - b.at);
}

export type HistoryInput = { id: string; title: string; also: string; at: string; status: string };
export function buildHistory(jobs: HistoryInput[]): Array<TimelineItem & { jobId: string }> {
  return jobs
    .map((j) => {
      const at = Date.parse(j.at);
      return { jobId: j.id, key: `job-${j.id}`, when: Number.isNaN(at) ? "" : short(at).toUpperCase(), title: j.title, sub: j.also, soon: false, pill: j.status.replace(/_/g, " "), at: Number.isNaN(at) ? 0 : at };
    })
    .sort((a, b) => b.at - a.at);
}

/** The car room shows only the latest visits; the full list lives on the Service history screen. */
export const HISTORY_PREVIEW = 3;
export const latestVisits = <T,>(past: T[]): T[] => past.slice(0, HISTORY_PREVIEW);

/** Count label shown beside a group heading. */
export const countLabel = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
