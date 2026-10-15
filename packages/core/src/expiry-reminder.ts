// Document expiry reminders: a customer is told 30 days, 7 days and on the day a verified paper expires.
// Pure, so the server job and the tests agree. Dates are YYYY-MM-DD in the studio's timezone.
export const EXPIRY_REMINDER_DAYS = [30, 7, 0] as const;
export type ExpiryReminderDay = (typeof EXPIRY_REMINDER_DAYS)[number];

const addDays = (ymd: string, n: number): string => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The expiry dates that are exactly a reminder distance from today. */
export function reminderTargetDates(today: string): { date: string; daysLeft: ExpiryReminderDay }[] {
  return EXPIRY_REMINDER_DAYS.map((daysLeft) => ({ date: addDays(today, daysLeft), daysLeft }));
}

const KIND_NAME: Record<string, string> = { RC: "RC", INSURANCE: "Insurance", PUC: "PUC", FASTAG: "FASTag", OTHER: "Document" };

/** Plain wording. No offer, no upsell. */
export function expiryReminderText(kind: string, daysLeft: ExpiryReminderDay, plate: string | null): { title: string; body: string } {
  const name = KIND_NAME[kind] ?? "Document";
  const car = plate ? ` for ${plate}` : "";
  if (daysLeft === 0) return { title: `${name} expires today`, body: `Your ${name}${car} expires today.` };
  return { title: `${name} expires in ${daysLeft} days`, body: `Your ${name}${car} expires in ${daysLeft} days. Renew it before then.` };
}
