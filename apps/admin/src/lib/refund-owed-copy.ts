import { formatPaise } from "./format";

/** Plain wording for money owed to a customer and NOT yet returned. Never says refunded, sent or initiated. */
export function refundOwedText(paise: number): string {
  return `Refund owed ${formatPaise(paise)}, not yet returned. Give it back to the customer by hand; the system has not sent anything.`;
}

/** Open total across bookings: shown beside, never netted into, revenue or cash. */
export function refundsOwedTotalText(paise: number, count: number, truncated: boolean): string | null {
  // The server did not send a usable total: say so instead of printing "- across undefined bookings".
  if (!Number.isFinite(paise) || !Number.isFinite(count)) return "Refunds owed to customers could not be totalled here. Check cancelled bookings for money still owed.";
  if (paise <= 0 && !truncated) return null;
  const base = `Refunds owed to customers: ${formatPaise(paise)} across ${count} ${count === 1 ? "booking" : "bookings"}, not yet returned. This is an open total, not for this period, and is not taken out of the figures above.`;
  return truncated ? `${base} Not every cancelled booking could be fully checked, so this total may be incomplete.` : base;
}

/** Client-side open total from a loaded booking list (cancelled only). listFull = the list hit its cap, so older bookings were not seen. */
export function owedFromBookings(bookings: { status: string; manualRefundDuePaise?: number | null }[], listFull: boolean): { paise: number; count: number; truncated: boolean } {
  let paise = 0, count = 0, bad = false;
  for (const b of bookings) {
    const d = b.manualRefundDuePaise;
    if (b.status !== "CANCELLED" || d === undefined || d === null || d === 0) continue;
    if (typeof d === "number" && Number.isSafeInteger(d) && d > 0) { paise += d; count += 1; } else bad = true;
  }
  return { paise, count, truncated: listFull || bad };
}
