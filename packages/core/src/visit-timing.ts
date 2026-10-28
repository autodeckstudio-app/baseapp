// One shared answer to "where is this visit against its planned time?", so Customer, Admin and Studio agree.
// Pure and display only: it never closes, cancels, moves or messages anything. Existing missed-booking handling
// (close-of-day auto-cancel) is unchanged; until it runs, a car that has not arrived keeps showing, never disappears.
// Uses only scheduledAt, estimatedEndAt and status. No promise beyond the planned end.

export type VisitPhase =
  | "upcoming" // booked, car not due yet
  | "due" // booked, slot has started, car not arrived, planned end not reached
  | "not_arrived" // booked, planned end passed, car never arrived (still open)
  | "running" // car arrived, within planned time
  | "overrun" // car arrived, past planned end
  | "ready" // work done, waiting for pickup
  | "closed"; // delivered, cancelled or otherwise nothing to time

export type VisitTone = "neutral" | "accent" | "warning" | "error" | "success";

export interface VisitTiming {
  phase: VisitPhase;
  /** Short plain label, e.g. "In 2h 10m", "Due now", "Over planned end by 40 min". Empty when closed. */
  label: string;
  tone: VisitTone;
  /** True when staff should look: due, not arrived, or overrun. */
  needsAttention: boolean;
  /** Within `soonMinutes` before the slot. Emphasis only. */
  soon: boolean;
  /** Minutes: until start (upcoming), since start (due), since end (not_arrived/overrun), until end (running). */
  minutes: number;
}

export interface VisitTimingOptions {
  /** Emphasise "starting soon" this many minutes before the slot. Review recommendation: 120 (the existing 2 h reminder mark). */
  soonMinutes?: number;
  /** Minutes after slot start before "Due" turns into "Late". Not set means no grace: shown as "Due now" with elapsed time. */
  lateAfterMinutes?: number;
}

export const RECOMMENDED_SOON_MINUTES = 120;

const STARTED = ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK"];

export function formatSpan(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const r = m % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
}

export function visitTiming(
  v: { status: string; scheduledAt: string; estimatedEndAt: string },
  now: number = Date.now(),
  opts: VisitTimingOptions = {},
): VisitTiming {
  const start = Date.parse(v.scheduledAt);
  const end = Date.parse(v.estimatedEndAt);
  const base = { soon: false, needsAttention: false, minutes: 0 };
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { ...base, phase: "closed", label: "", tone: "neutral" };
  const min = (ms: number) => Math.floor(ms / 60000);

  if (v.status === "READY_FOR_DELIVERY") return { ...base, phase: "ready", label: "Ready, waiting for pickup", tone: "success" };
  if (STARTED.includes(v.status)) {
    if (now > end) return { ...base, phase: "overrun", label: `Over planned end by ${formatSpan(min(now - end))}`, tone: "error", needsAttention: true, minutes: min(now - end) };
    return { ...base, phase: "running", label: `Planned end in ${formatSpan(min(end - now))}`, tone: "accent", minutes: min(end - now) };
  }
  if (v.status === "PENDING_VEHICLE" || v.status === "STANDBY") {
    if (now < start) {
      const until = min(start - now);
      const soon = until <= (opts.soonMinutes ?? 0);
      return { ...base, phase: "upcoming", label: `In ${formatSpan(until)}`, tone: soon ? "warning" : "neutral", soon, minutes: until };
    }
    if (now < end) {
      const since = min(now - start);
      const late = opts.lateAfterMinutes !== undefined && since >= opts.lateAfterMinutes;
      return { ...base, phase: "due", label: late ? `Late, ${formatSpan(since)} past start` : since === 0 ? "Due now" : `Due now, ${formatSpan(since)} since start`, tone: late ? "error" : "warning", needsAttention: true, minutes: since };
    }
    return { ...base, phase: "not_arrived", label: `Not arrived, slot ended ${formatSpan(min(now - end))} ago`, tone: "error", needsAttention: true, minutes: min(now - end) };
  }
  return { ...base, phase: "closed", label: "", tone: "neutral" };
}
