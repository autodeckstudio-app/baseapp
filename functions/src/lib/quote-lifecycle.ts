import { HttpsError } from 'firebase-functions/v2/https';
export const QUOTE_VALID_MS = 7 * 24 * 60 * 60 * 1000;
/** Expiry applies to an unanswered offer, not already approved work. Legacy
 * unanswered offers without a recorded expiry fail closed and need reissue. */
type QuoteOffer = { status?: unknown; quoteStatus?: unknown; totalAmount?: unknown; updatedAt?: unknown; quoteExpiresAt?: string | null | undefined };
export function assertQuoteOfferCurrent(b: QuoteOffer, expectedTotal: number, expectedVersion: string, now: number) {
  if (!['CONFIRMED', 'ACTIVE', 'PENDING'].includes(String(b.status)) || b.quoteStatus !== 'quoted')
    throw new HttpsError('failed-precondition', 'There is no open quote to answer.');
  if (b.totalAmount !== expectedTotal || b.updatedAt !== expectedVersion)
    throw new HttpsError('failed-precondition', 'The quote changed. Review the current scope and total first.');
  const expiry = Date.parse(b.quoteExpiresAt ?? '');
  if (!Number.isFinite(expiry) || now >= expiry)
    throw new HttpsError('failed-precondition', 'This quote expired. Ask the office for a new quote.');
}
