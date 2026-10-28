import type { JobStatus } from "./types/job.js";
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
  | "standby" // arrived, waiting for a bay: no reserved window to time against
  | "unknown" // still open but the stored times are unreadable: never shown as finished
  | "closed"; // delivered or cancelled: nothing to time

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
  v: { status: JobStatus; scheduledAt: string; estimatedEndAt: string },
  now: number = Date.now(),
  opts: VisitTimingOptions = {},
): VisitTiming {
  const base = { soon: false, needsAttention: false, minutes: 0 };
  // Statuses that are over: nothing to time.
  if (v.status === "DELIVERED" || v.status === "CANCELLED") return { ...base, phase: "closed", label: "", tone: "neutral" };
  // Arrived and waiting for a bay: no window is reserved, so no countdown or lateness applies.
  if (v.status === "STANDBY") return { ...base, phase: "standby", label: "Arrived, waiting for a bay", tone: "accent" };
  if (v.status === "READY_FOR_DELIVERY") return { ...base, phase: "ready", label: "Ready, waiting for pickup", tone: "success" };
  const start = Date.parse(v.scheduledAt);
  const end = Date.parse(v.estimatedEndAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { ...base, phase: "unknown", label: "", tone: "neutral" };
  const min = (ms: number) => Math.floor(ms / 60000);

  switch (v.status) {
    case "VEHICLE_RECEIVED":
    case "IN_PROGRESS":
    case "QUALITY_CHECK":
      if (now > end) return { ...base, phase: "overrun", label: `Over planned end by ${formatSpan(min(now - end))}`, tone: "error", needsAttention: true, minutes: min(now - end) };
      return { ...base, phase: "running", label: `Planned end in ${formatSpan(min(end - now))}`, tone: "accent", minutes: min(end - now) };
    case "PENDING_VEHICLE": {
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
    default: {
      const unreachable: never = v.status; // a new JobStatus must be handled above
      return unreachable;
    }
  }
}

/** Customer-facing line, built from the structured phase. Factual and neutral; no ETA beyond the planned end. Empty = show nothing. */
export function customerTimingLine(t: Pick<VisitTiming, "phase" | "minutes" | "label">): string {
  switch (t.phase) {
    case "upcoming": return t.label;
    case "due": return "Your slot has started";
    case "not_arrived": return "Your slot has ended and your car has not been checked in";
    case "running": return `Planned end in ${formatSpan(t.minutes)}`;
    case "overrun": return `Taking longer than planned: the planned end passed ${formatSpan(t.minutes)} ago`;
    case "ready": return "Ready for pickup";
    case "standby": return "Your car has arrived and is waiting for a bay";
    case "unknown":
    case "closed": return "";
  }
}
