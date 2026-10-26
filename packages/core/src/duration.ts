/** Shared duration text (round 7 point 14), used by the customer, studio and admin apps. Display only; never used for booking maths.
 *  Under 60: "45 mins". Exact hours: "6 hr". Otherwise "6 hr 45 mins". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min${r === 1 ? "" : "s"}`;
}
