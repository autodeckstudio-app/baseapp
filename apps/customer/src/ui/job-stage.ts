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

export function jobStage(status: string): { index: number; headline: string; line: string } | null {
  return BY_STATUS[status] ?? null;
}

/** An "expected ready" time is only worth showing while it is still ahead of us (a multi-day walk-in can carry a stale one). */
export function readyIsAhead(date: string, time: string, now = Date.now()): boolean {
  const t = Date.parse(`${date}T${time.length === 5 ? time + ":00" : time}+05:30`);
  return !Number.isNaN(t) && t > now;
}
