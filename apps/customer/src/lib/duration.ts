/** Shared duration text (round 7 point 14). Under 60: "45 mins". Exact hours: "6 hr". Otherwise "6 hr 45 mins". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min${r === 1 ? "" : "s"}`;
}

/** Catalogue cards: unchanged day wording from 8 hours up (an 8-hour working day), the shared text below that. */
export function formatDurationWithDays(minutes: number): string {
  if (minutes >= 480) return `${Math.round(minutes / 480)} day${minutes >= 960 ? "s" : ""}`;
  return formatDuration(minutes);
}

/** Booking confirm and booking detail: "~" prefix; a day or more stays "~N hrs of service time" as before (service time, not calendar time). */
export function formatServiceTime(minutes: number): string {
  if (minutes < 24 * 60) return `~${formatDuration(minutes)}`;
  return `~${Math.round(minutes / 60)} hrs of service time`;
}
