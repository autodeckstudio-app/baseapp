import { createHash } from 'node:crypto';
import type { VerifyWebhookParams } from './payment-provider.js';
import type { VisitCaptureEvidence } from './visit-provider-attempt.js';

type Inspection = { outcome: 'unrelated' | 'review_required' } | { outcome: 'capture'; evidence: VisitCaptureEvidence };
const id = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(x);
const object = (x: unknown): Record<string, any> | null => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, any> : null;

/** Dormant raw-body boundary, not an HTTP route. Verify BEFORE parsing and
 * never reuse the legacy parser's inferred INR or merged entity identities.
 * Only a complete full-link captured event can enter the capture journal.
 * A review result is NOT acknowledgement/settlement: future dispatch must
 * retain a review alert and reconciliation work, including partial/refunded
 * or payment-only events that cannot establish a complete link identity.
 * Source: https://razorpay.com/docs/webhooks/payment-links */
export function inspectVisitProviderWebhook(rawBody: string, signature: string, headerEventId: string,
  verify: (input: VerifyWebhookParams) => boolean): Inspection {
  if (!rawBody || !signature || !verify({ rawBody, signature })) throw new Error('Invalid provider signature.');
  let body: Record<string, any> | null;
  try { body = object(JSON.parse(rawBody)); } catch { return { outcome: 'review_required' }; }
  if (!body) return { outcome: 'review_required' };
  const payload = object(body['payload']), link = object(object(payload?.['payment_link'])?.['entity']), payment = object(object(payload?.['payment'])?.['entity']);
  const reference = link?.['reference_id'];
  // Only explicit non-visit references are unrelated. Missing identity on a
  // money event remains unknown, not evidence that this visit was not paid.
  if (typeof reference === 'string' && !reference.startsWith('vp_')) return { outcome: 'unrelated' };
  if (body['event'] !== 'payment_link.paid' || !link || !payment || typeof reference !== 'string' || !/^vp_[a-f0-9]{32}$/.test(reference)) return { outcome: 'review_required' };
  const amount = payment['amount'];
  if (!id(link['id']) || !id(payment['id']) || !id(link['order_id']) || payment['order_id'] !== link['order_id'] ||
    payment['currency'] !== 'INR' || link['currency'] !== 'INR' || payment['status'] !== 'captured' || payment['captured'] !== true ||
    payment['amount_refunded'] !== 0 || link['status'] !== 'paid' || link['accept_partial'] !== false ||
    !Number.isSafeInteger(amount) || amount <= 0 || amount !== link['amount'] || amount !== link['amount_paid'] ||
    headerEventId !== '' && !id(headerEventId)) return { outcome: 'review_required' };
  return { outcome: 'capture', evidence: { eventType: 'payment_link.paid',
    eventId: headerEventId || createHash('sha256').update(rawBody).digest('hex'), referenceId: reference,
    providerPaymentId: payment['id'], providerLinkId: link['id'], providerOrderId: link['order_id'], amountPaise: amount, currency: 'INR' } };
}
