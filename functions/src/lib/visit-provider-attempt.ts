import { isDeepStrictEqual } from 'node:util';
import { allocateVisitReceipt, type VisitCollectionReview } from '@autodeck/core';

/** Local qualification seam only. No callable, provider or webhook imports this
 * module yet. A later durable adapter must persist each transition atomically
 * before executing its command; this planner does not itself authorize effects. */
export const visitProviderCollectionEnabled = (): boolean => false;

type Binding = {
  id: string; tenantId: string; studioId: string; customerId: string;
  visitId: string; billId: string; reviewToken: string; currency: 'INR';
  amountPaise: number; review: VisitCollectionReview; allocation: ReturnType<typeof allocateVisitReceipt>;
};
type Link = { providerLinkId: string; providerOrderId: string | null; paymentUrl: string };
type Capture = { providerPaymentId: string; firstEventId: string; amountPaise: number; currency: 'INR' };
export type VisitProviderAttempt = Binding & {
  state: 'claimed' | 'submitting' | 'uncertain' | 'link_ready' | 'captured' | 'captured_review';
  link: Link | null; capture: Capture | null;
};
const id = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(s);
const fail = (): never => { throw new Error('Visit provider attempt needs review.'); };
const validToken = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);

/** Full current balance only. Paid, cancelled and covered lines stay outside
 * the new captured allocation, just as they do for actual offline receipts. */
export function planVisitProviderClaim(input: {
  id: string; tenantId: string; studioId: string; customerId: string; billId: string;
  reviewToken: string; review: VisitCollectionReview; expectedBalancePaise: number;
}): VisitProviderAttempt {
  if (input.id.length>40 || ![input.id, input.tenantId, input.studioId, input.customerId, input.billId, input.review.visitId].every(id) || !validToken(input.reviewToken)) return fail();
  const allocation = allocateVisitReceipt(input.review, input.expectedBalancePaise);
  if (allocation.balancePaise !== 0 || allocation.unappliedPaise !== 0) return fail();
  return { id: input.id, tenantId: input.tenantId, studioId: input.studioId, customerId: input.customerId,
    visitId: input.review.visitId, billId: input.billId, reviewToken: input.reviewToken, currency: 'INR',
    amountPaise: input.expectedBalancePaise, review: structuredClone(input.review), allocation, state: 'claimed', link: null, capture: null };
}

/** Only the transition out of claimed emits create. A submitting state saved
 * before a crash is uncertain, never evidence that provider creation did not
 * happen. Exact retry and timeout therefore never emit another create. */
export function assertVisitProviderAttempt(attempt: VisitProviderAttempt): void {
  if (attempt.id.length>40 || ![attempt.id, attempt.tenantId, attempt.studioId, attempt.customerId, attempt.visitId, attempt.billId].every(id) ||
    !validToken(attempt.reviewToken) || attempt.currency !== 'INR' || attempt.review?.visitId !== attempt.visitId ||
    !['claimed','submitting','uncertain','link_ready','captured','captured_review'].includes(attempt.state)) return fail();
  const actual = allocateVisitReceipt(attempt.review, attempt.amountPaise);
  if (actual.balancePaise || actual.unappliedPaise || !isDeepStrictEqual(actual, attempt.allocation)) return fail();
  const bound = ['link_ready','captured','captured_review'].includes(attempt.state);
  if (bound !== !!attempt.link || ['captured','captured_review'].includes(attempt.state) !== !!attempt.capture) return fail();
  if (attempt.link) {
    let url: URL;
    try { url = new URL(attempt.link.paymentUrl); } catch { return fail(); }
    if (!id(attempt.link.providerLinkId) || attempt.link.providerOrderId !== null && !id(attempt.link.providerOrderId) || url.protocol !== 'https:' || url.username || url.password) return fail();
  }
  if (attempt.capture && (!id(attempt.capture.providerPaymentId) || !id(attempt.capture.firstEventId) || attempt.capture.amountPaise !== attempt.amountPaise || attempt.capture.currency !== 'INR')) return fail();
}

export function planVisitProviderSubmission(attempt: VisitProviderAttempt) {
  assertVisitProviderAttempt(attempt);
  if (attempt.state !== 'claimed') return { attempt, command: null };
  return { attempt: { ...attempt, state: 'submitting' as const },
    command: { kind: 'create_visit_payment_link' as const, referenceId: attempt.id,
      amountPaise: attempt.amountPaise, currency: attempt.currency } };
}
export function planVisitProviderUncertain(attempt: VisitProviderAttempt): VisitProviderAttempt {
  assertVisitProviderAttempt(attempt);
  return attempt.state === 'submitting' ? { ...attempt, state: 'uncertain' } : attempt;
}

/** Called only with a provider result or owner-bound reconciliation evidence.
 * A reference is not idempotency support at the provider. Missing results or
 * an inconclusive lookup must not be fed here as permission to create again. */
export function planVisitProviderLink(attempt: VisitProviderAttempt, evidence: Link & {
  referenceId: string; amountPaise: number; currency: string;
}): VisitProviderAttempt {
  assertVisitProviderAttempt(attempt);
  let url: URL;
  try { url = new URL(evidence.paymentUrl); } catch { return fail(); }
  if (evidence.referenceId !== attempt.id || evidence.amountPaise !== attempt.amountPaise || evidence.currency !== attempt.currency ||
    !id(evidence.providerLinkId) || evidence.providerOrderId !== null && !id(evidence.providerOrderId) ||
    url.protocol !== 'https:' || url.username || url.password) return fail();
  const link: Link = { providerLinkId: evidence.providerLinkId, providerOrderId: evidence.providerOrderId, paymentUrl: evidence.paymentUrl };
  if (attempt.link) {
    if (attempt.link.providerLinkId !== link.providerLinkId || attempt.link.providerOrderId !== link.providerOrderId || attempt.link.paymentUrl !== link.paymentUrl) return fail();
    return attempt;
  }
  if (!['submitting', 'uncertain'].includes(attempt.state)) return fail();
  return { ...attempt, link, state: 'link_ready' };
}

export type VisitCaptureEvidence = {
  eventType: string; eventId: string; referenceId: string; providerPaymentId: string;
  providerLinkId: string; providerOrderId: string | null; amountPaise: number; currency: string;
};
/** This is a planner for already signature-verified captured evidence, never
 * signature verification. A failure/expired/cancelled-link event proves no
 * absence of money and cannot release the attempt. Capture before a persisted
 * link binding must wait for reconciliation, not manufacture that binding.
 * A changed bill preserves the actual capture but forbids automatic allocation. */
export function planVisitProviderCapture(attempt: VisitProviderAttempt, event: VisitCaptureEvidence, currentReviewToken: string) {
  assertVisitProviderAttempt(attempt);
  if (!['payment.captured', 'payment_link.paid'].includes(event.eventType)) return { attempt, outcome: 'held' as const, allocation: null };
  const link = attempt.link;
  if (!link || !id(event.eventId) || !id(event.providerPaymentId) || event.referenceId !== attempt.id ||
    event.providerLinkId !== link.providerLinkId || event.providerOrderId !== link.providerOrderId ||
    event.amountPaise !== attempt.amountPaise || event.currency !== attempt.currency) return { attempt, outcome: 'held' as const, allocation: null };
  if (attempt.capture) {
    if (attempt.capture.providerPaymentId !== event.providerPaymentId) return { attempt, outcome: 'extra_capture_review' as const, allocation: null };
    return { attempt, outcome: 'duplicate' as const, allocation: null };
  }
  if (attempt.state !== 'link_ready') return { attempt, outcome: 'held' as const, allocation: null };
  const capture: Capture = { providerPaymentId: event.providerPaymentId, firstEventId: event.eventId, amountPaise: event.amountPaise, currency: 'INR' };
  if (!validToken(currentReviewToken) || currentReviewToken !== attempt.reviewToken)
    return { attempt: { ...attempt, state: 'captured_review' as const, capture }, outcome: 'captured_review' as const, allocation: null };
  return { attempt: { ...attempt, state: 'captured' as const, capture }, outcome: 'captured' as const, allocation: attempt.allocation };
}
