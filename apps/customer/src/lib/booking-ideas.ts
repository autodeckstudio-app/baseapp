import { SERVICE_INCLUDES, type Service } from "@autodeck/core";
import { nextDue, type FinishedJob } from "./care-due";

/** What the empty Bookings page can offer, from real history and the live catalogue only. Every function returns null or [] when there is no data, so the block is hidden. */
export type Day = "today" | "tomorrow" | "weekend";
export const DAYS: Array<{ key: Day; label: string }> = [{ key: "today", label: "Today" }, { key: "tomorrow", label: "Tomorrow" }, { key: "weekend", label: "Weekend" }];

/** The service of the most recent completed booking on this car. */
export function lastServiceFor(bookings: Array<{ vehicleId?: string; serviceId?: string | null; status: string; scheduledAt: string }>, vehicleId: string | null): string | null {
  if (!vehicleId) return null;
  const hit = [...bookings].filter((b) => b.vehicleId === vehicleId && b.status === "COMPLETED" && !!b.serviceId).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0];
  return hit?.serviceId ?? null;
}

/** The soonest thing due on this car if it is overdue or due within `withinDays`, from delivered visits only. */
export function dueSoonFor(jobs: Array<FinishedJob & { vehicleId?: string }>, vehicleId: string | null, services: Record<string, Service>, now = Date.now(), withinDays = 30): { service: Service; label: string; days: number } | null {
  if (!vehicleId) return null;
  const d = nextDue(jobs.filter((j) => j.vehicleId === vehicleId), services, now);
  if (!d) return null;
  const days = Math.round((d.dueAt.getTime() - now) / 86_400_000);
  return days <= withinDays ? { service: services[d.service.id]!, label: d.label, days } : null;
}

const addDays = (ymd: string, n: number): string => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isWeekend = (ymd: string): boolean => { const w = new Date(`${ymd}T12:00:00Z`).getUTCDay(); return w === 0 || w === 6; };

/** The first offered date that matches the chip, or null when that day has no free time. */
export function pickDay(dates: string[], day: Day | string | undefined, todayIst: string): string | null {
  const sorted = [...dates].sort();
  if (day === "today") return sorted.find((d) => d === todayIst) ?? null;
  if (day === "tomorrow") return sorted.find((d) => d === addDays(todayIst, 1)) ?? null;
  if (day === "weekend") return sorted.find((d) => isWeekend(d) && d >= todayIst) ?? null;
  return null;
}

/** Live service ids the owner's catalogue presents as packages (read from the admin catalogue, 22 Oct 2026). A service shows under Combos only when its id is listed here AND it is active, has a fixed price and states its contents in its own description. */
export const PACKAGE_SERVICE_IDS: readonly string[] = ["svc-wash-detail-spa", "svc-wash-premium", "menu-wash-exterior"];

/** Packages: a service that contains other menu services (Full detail wash), or a listed package id whose own description lists what is included.
 *  Shown with the service's real id and price and its own words. Nothing is invented. */
export function comboCards(catalogue: Service[]): Array<{ service: Service; parts: string[] }> {
  const byId = new Map(catalogue.map((s) => [s.id, s]));
  const out: Array<{ service: Service; parts: string[] }> = [];
  const seen = new Set<string>();
  const ok = (s?: Service): s is Service => !!s && s.active !== false && !s.priceOnRequest;
  for (const [big, partIds] of Object.entries(SERVICE_INCLUDES)) {
    const s = byId.get(big);
    const parts = partIds.map((p) => byId.get(p)).filter((x): x is Service => !!x);
    if (ok(s) && parts.length === partIds.length) { out.push({ service: s, parts: parts.map((p) => p.name) }); seen.add(s.id); }
  }
  for (const id of PACKAGE_SERVICE_IDS) {
    const s = byId.get(id);
    const d = (s?.description ?? "").replace(/\r?\n/g, " ").trim();
    if (ok(s) && d && !seen.has(id)) out.push({ service: s, parts: [d.replace(/([.:])\s+-\s+/, "$1 ").replace(/\s+-\s+/g, ", ")] });
  }
  return out;
}
