/** Customer-facing stages of a studio job. Four steps, plain words, one sentence each. */
export const STAGES = ["Dropped off", "In progress", "Final checks", "Ready"] as const;

const BY_STATUS: Record<string, { index: number; headline: string; line: string }> = {
  PENDING_VEHICLE: { index: -1, headline: "Waiting for your car", line: "Bring it in at your booked time." },
  VEHICLE_RECEIVED: { index: 0, headline: "Car received", line: "The team has your car and will start shortly." },
  IN_PROGRESS: { index: 1, headline: "Work in progress", line: "Your car is being worked on now." },
  QUALITY_CHECK: { index: 2, headline: "Final checks", line: "Nearly done. The team is checking the finish." },
  READY_FOR_DELIVERY: { index: 3, headline: "Ready for pickup", line: "Come by any time before closing." },
  DELIVERED: { index: 3, headline: "Delivered", line: "Thanks for choosing AutoDeck." },
};

/** `slotStarted`: the booked start time has passed and the car has not arrived. "Bring it in at your booked time" would then
 *  be stale advice, so the line only states the fact (no new policy, no promised time). */
export function jobStage(status: string, slotStarted = false): { index: number; headline: string; line: string } | null {
  const s = BY_STATUS[status] ?? null;
  return s && status === "PENDING_VEHICLE" && slotStarted ? { ...s, line: "Your booked time has started and your car has not arrived yet." } : s;
}

/** An "expected ready" time is only worth showing while it is still ahead of us (a multi-day walk-in can carry a stale one). */
export function readyIsAhead(date: string, time: string, now = Date.now()): boolean {
  const t = Date.parse(`${date}T${time.length === 5 ? time + ":00" : time}+05:30`);
  return !Number.isNaN(t) && t > now;
}

export type TimelineStep = { label: string; at: string | null; state: "done" | "now" | "next" };
const STEP_STATUS = ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"] as const;
const STEP_LABEL = ["Car received", "Work started", "Final checks", "Ready for pickup"];

/** The four visible steps with the time each began, from the job's own status history. Staff notes are never shown. */
export function jobTimeline(status: string, history: Array<{ status: string; changedAt: string }>): TimelineStep[] {
  const cur = jobStage(status)?.index ?? -1;
  return STEP_STATUS.map((s, i) => {
    const hit = history.filter((h) => h.status === s).sort((a, b) => a.changedAt.localeCompare(b.changedAt))[0];
    const state: TimelineStep["state"] = i < cur || (status === "DELIVERED" && i <= cur) ? "done" : i === cur ? "now" : "next";
    return { label: STEP_LABEL[i]!, at: hit && state !== "next" ? hit.changedAt : null, state };
  });
}
