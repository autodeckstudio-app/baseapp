import { formatPaise } from "./format";

/** Plain wording for money owed to a customer and NOT yet returned. Never says refunded, sent or initiated. */
export function refundOwedText(paise: number): string {
  return `Refund owed ${formatPaise(paise)}, not yet returned. Give it back to the customer by hand; the system has not sent anything.`;
}

/** Open total across bookings: shown beside, never netted into, revenue or cash. */
export function refundsOwedTotalText(paise: number, count: number, truncated: boolean): string | null {
  if (paise <= 0 && !truncated) return null;
  const base = `Refunds owed to customers: ${formatPaise(paise)} across ${count} ${count === 1 ? "booking" : "bookings"}, not yet returned. This is an open total, not for this period, and is not taken out of the figures above.`;
  return truncated ? `${base} More cancelled bookings exist than were checked, so this total may be incomplete.` : base;
}
