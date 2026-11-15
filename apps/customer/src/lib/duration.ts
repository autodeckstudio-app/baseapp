import { formatDuration } from "@autodeck/core";
export { formatDuration };

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
