// Garage helpers: the live job on one car and the care-plan ring. Pure, no hidden numbers.
import { liveStep } from "./live-step";

export const LIVE_PROGRESS: Record<string, number> = { PENDING_VEHICLE: 10, VEHICLE_RECEIVED: 25, IN_PROGRESS: 55, QUALITY_CHECK: 85, READY_FOR_DELIVERY: 100, DELIVERED: 100 };
export const LIVE_STEP_NAMES = ["Received", "In progress", "Final checks", "Ready"];
const LIVE = ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"];

type JobLite = { id: string; status: string; vehicleId?: string; bookingId?: string | null; estimatedEndAt?: string | null };

/** The job in the studio right now for this car, or null. */
export function liveJobForCar<J extends JobLite>(jobs: J[], vehicleId: string): J | null {
  return jobs.find((j) => j.vehicleId === vehicleId && LIVE.includes(j.status)) ?? null;
}

/** Which of the four steps the job is on (0-3). */
export function jobStep(status: string): number { return liveStep(LIVE_PROGRESS[status] ?? 10); }

/** Ready-by time only when the studio set one and it is still ahead. Never invented. */
export function readyBy(job: { estimatedEndAt?: string | null }, now = Date.now()): string | null {
  if (!job.estimatedEndAt) return null;
  const t = new Date(job.estimatedEndAt).getTime();
  return Number.isFinite(t) && t > now ? new Date(t).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" }) : null;
}

/** Ring for an active plan: share of washes still left, plus its words. Null when there is no active plan with washes. */
export function careRing(m: { status: string; washesTotal: number; washesUsed: number; endDate?: string | null; tier?: string } | null | undefined, now = Date.now()): { fraction: number; left: number; total: number; line: string; sub: string } | null {
  if (!m || m.status !== "active" || m.washesTotal <= 0) return null;
  const left = Math.max(0, m.washesTotal - m.washesUsed);
  const days = m.endDate ? Math.max(0, Math.ceil((new Date(m.endDate).getTime() - now) / 86_400_000)) : null;
  const tier = m.tier ? m.tier.charAt(0).toUpperCase() + m.tier.slice(1) : "Club";
  return { fraction: left / m.washesTotal, left, total: m.washesTotal, line: days === null ? `${tier} plan` : `${tier}, ${days} ${days === 1 ? "day" : "days"} left`, sub: left === 0 ? "No washes left on this plan" : `${left} of ${m.washesTotal} washes left` };
}
