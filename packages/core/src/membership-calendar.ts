/** Membership calendar policy: the displayed end date is inclusive in IST.
 * Timestamp/audit fields remain UTC instants. Existing purchased dates are never rewritten.
 * Keep the existing duration offset: activation day + MEMBERSHIP_DURATION_DAYS.
 */
export function membershipDay(now: Date | number | string = new Date()): string {
  // Date-only arguments are already calendar dates, not UTC instants.
  if (typeof now === "string" && /^\d{4}-\d{2}-\d{2}$/.test(now)) return now;
  const ms = now instanceof Date ? now.getTime() : typeof now === "number" ? now : Date.parse(now);
  return new Date(ms + 330 * 60_000).toISOString().slice(0, 10);
}

/** New activations only. Same +durationDays offset, now anchored to IST. */
export function membershipTermDates(now: Date | number | string, durationDays: number): { startDate: string; endDate: string } {
  const startDate = membershipDay(now);
  const anchor = Date.parse(`${startDate}T00:00:00Z`);
  return { startDate, endDate: new Date(anchor + durationDays * 86_400_000).toISOString().slice(0, 10) };
}
