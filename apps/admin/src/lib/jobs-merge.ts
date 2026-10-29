import type { ServiceJob } from "@autodeck/core";

/** Every status a job holds while it is still open (not DELIVERED or CANCELLED). These are read in full (equality
 *  filters only) alongside the newest-300 feed, so an old job stuck open is not cut off. */
export const OPEN_JOB_STATUSES = ["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"] as const;

/** Milliseconds from an ISO string, a number, or a Firestore Timestamp-like object; NaN when unreadable. */
export function timeMs(v: unknown): number {
  if (typeof v === "string") return Date.parse(v);
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (v && typeof v === "object") {
    const o = v as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof o.toMillis === "function") { const m = o.toMillis(); return Number.isFinite(m) ? m : NaN; }
    if (typeof o.seconds === "number") return o.seconds * 1000 + Math.floor((o.nanoseconds ?? 0) / 1e6);
  }
  return NaN;
}

/** Pick the fresher of two copies of the same job. By updatedAt when both are readable; a readable one beats
 *  an unreadable one; otherwise keep the first copy (the newest-300 feed), so the result never depends on timing. */
function fresher(a: ServiceJob, b: ServiceJob): ServiceJob {
  const ta = timeMs((a as { updatedAt?: unknown }).updatedAt);
  const tb = timeMs((b as { updatedAt?: unknown }).updatedAt);
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb > ta ? b : a;
  if (Number.isNaN(ta) && !Number.isNaN(tb)) return b;
  return a;
}

/** Union by id, newest first. Jobs with an unreadable createdAt sort last (then by id); never throws. */
export function mergeJobFeeds(recent: ServiceJob[], openByStatus: ServiceJob[][]): ServiceJob[] {
  const byId = new Map<string, ServiceJob>();
  for (const list of [recent, ...openByStatus]) for (const j of list) { const cur = byId.get(j.id); byId.set(j.id, cur ? fresher(cur, j) : j); }
  const key = (j: ServiceJob) => { const t = timeMs((j as { createdAt?: unknown }).createdAt); return Number.isNaN(t) ? -Infinity : t; };
  return [...byId.values()].sort((x, y) => { const a = key(x), b = key(y); return a === b ? String(x.id).localeCompare(String(y.id)) : b > a ? 1 : -1; });
}
