/** A customer whose last delivered visit is this many days old gets one plain "we miss you" nudge. Config, not law. */
export const WINBACK_DAYS = 90;
/** After a nudge, wait at least this long before the next one. */
export const WINBACK_COOLDOWN_DAYS = 90;

const DAY = 86_400_000;

export interface WinbackInput {
  /** customerId -> ISO time of their most recent DELIVERED visit. */
  lastVisit: Record<string, string>;
  /** customerIds with a booking that is still open (pending, confirmed, in the studio). They are already coming back. */
  hasOpenBooking: Set<string>;
  /** customerId -> ISO time of the last win-back nudge. */
  lastNudge: Record<string, string>;
  now: number;
}

/** Who to nudge now. A customer is skipped if they have an open booking, were nudged recently, or visited inside the window. */
export function selectWinbackTargets(i: WinbackInput, days = WINBACK_DAYS, cooldownDays = WINBACK_COOLDOWN_DAYS): string[] {
  const out: string[] = [];
  for (const [id, last] of Object.entries(i.lastVisit)) {
    const t = Date.parse(last);
    if (Number.isNaN(t) || i.now - t < days * DAY) continue;
    if (i.hasOpenBooking.has(id)) continue;
    const n = i.lastNudge[id] ? Date.parse(i.lastNudge[id]!) : NaN;
    if (!Number.isNaN(n) && i.now - n < cooldownDays * DAY) continue;
    out.push(id);
  }
  return out.sort();
}
