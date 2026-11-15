import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { assertVisitProviderAttempt, planVisitProviderCapture, type VisitCaptureEvidence, type VisitProviderAttempt } from './visit-provider-attempt.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
/** Dormant INTERNAL verified-event seam. No HTTP/callable exports, signature
 * verification, provider calls, paid projection, invoice or accounting effect.
 * The future webhook must verify the raw signature before calling this. All
 * captures stay review-held until the atomic settlement adapter is qualified.
 * Exact held events may be reevaluated after missing link binding is recovered;
 * absence of a link never becomes proof that money did not arrive. */
export async function recordVerifiedVisitCaptureEvidence(db: Firestore, event: VisitCaptureEvidence) {
  if (!event || !validId(event.eventId) || !validId(event.referenceId) || !validId(event.providerPaymentId) ||
    !validId(event.providerLinkId) || event.providerOrderId !== null && !validId(event.providerOrderId) ||
    !['payment.captured', 'payment_link.paid'].includes(event.eventType) || !Number.isSafeInteger(event.amountPaise) || event.amountPaise <= 0 ||
    typeof event.currency !== 'string' || !/^[A-Z]{3}$/.test(event.currency)) throw new HttpsError('invalid-argument', 'Invalid visit capture evidence.');
  const canonical = { eventType: event.eventType, eventId: event.eventId, referenceId: event.referenceId, providerPaymentId: event.providerPaymentId,
    providerLinkId: event.providerLinkId, providerOrderId: event.providerOrderId, amountPaise: event.amountPaise, currency: event.currency };
  const payloadHash = hash(canonical), eventRef = db.collection('visitProviderEvents').doc('ve_' + hash(event.eventId));
  const paymentRef = db.collection('visitProviderCaptures').doc('vc_' + hash(event.providerPaymentId));
  return db.runTransaction(async tx => {
    const [originalEvent, stored, existingPayment, ingressReview] = await Promise.all([tx.get(eventRef), tx.get(db.collection('visitProviderAttempts').doc(event.referenceId)), tx.get(paymentRef), tx.get(db.collection('visitProviderIngressReviews').doc('vir_' + createHash('sha256').update(event.eventId).digest('hex')))]);
    if (ingressReview.exists) throw new HttpsError('already-exists', 'Provider event identity already belongs to incomplete evidence.');
    const oldEvent = originalEvent.data(), prior = stored.data();
    if (oldEvent && oldEvent['payloadHash'] !== payloadHash) throw new HttpsError('already-exists', 'Provider event identity conflicts with its original evidence.');
    if (oldEvent && oldEvent['outcome'] !== 'held') return { outcome: oldEvent['outcome'] as string, duplicateEvent: true };
    const now = new Date().toISOString();
    const saveEvent = (outcome: string, scope?: VisitProviderAttempt) => {
      tx.set(eventRef, { id: eventRef.id, payloadHash, evidence: canonical, outcome,
        tenantId: scope?.tenantId ?? null, studioId: scope?.studioId ?? null, visitId: scope?.visitId ?? null,
        createdAt: oldEvent?.['createdAt'] ?? now, updatedAt: now });
      return { outcome, duplicateEvent: false };
    };
    if (!prior) return saveEvent('held');
    const attempt = prior['attempt'] as VisitProviderAttempt;
    assertVisitProviderAttempt(attempt);
    if (prior['id'] !== event.referenceId || attempt.id !== event.referenceId || prior['tenantId'] !== attempt.tenantId || prior['studioId'] !== attempt.studioId || prior['visitId'] !== attempt.visitId)
      throw new HttpsError('failed-precondition', 'Visit provider original identity needs review.');
    const head = (await tx.get(db.collection('visitProviderHeads').doc(attempt.visitId))).data();
    if (!head || head['attemptId'] !== attempt.id || head['tenantId'] !== attempt.tenantId || head['visitId'] !== attempt.visitId)
      throw new HttpsError('failed-precondition', 'Visit provider reconciliation hold is missing.');
    // Empty current token deliberately prevents any automatic allocation.
    const planned = planVisitProviderCapture(attempt, canonical, '');
    if (planned.outcome === 'held') {if(head['status']==='settled')tx.update(db.collection('visitProviderHeads').doc(attempt.visitId),{status:'review_required',updatedAt:now});return saveEvent('held', attempt);}
    const identity = existingPayment.data();
    if (identity && (identity['providerPaymentId'] !== event.providerPaymentId || identity['attemptId'] !== attempt.id || identity['tenantId'] !== attempt.tenantId ||
      identity['studioId'] !== attempt.studioId || identity['visitId'] !== attempt.visitId || identity['providerLinkId'] !== event.providerLinkId || identity['providerOrderId'] !== event.providerOrderId ||
      identity['amountPaise'] !== event.amountPaise || identity['currency'] !== event.currency)) {tx.update(db.collection('visitProviderHeads').doc(attempt.visitId),{status:'review_required',updatedAt:now});return saveEvent('identity_conflict_review', attempt);}
    if (planned.outcome === 'duplicate' && !identity) throw new HttpsError('failed-precondition', 'Original captured payment identity is missing.');
    if(planned.outcome==='extra_capture_review')tx.update(db.collection('visitProviderHeads').doc(attempt.visitId),{status:'review_required',updatedAt:now});
    if (!identity) tx.create(paymentRef, { id: paymentRef.id, providerPaymentId: event.providerPaymentId, attemptId: attempt.id, tenantId: attempt.tenantId,
      studioId: attempt.studioId, visitId: attempt.visitId, providerLinkId: event.providerLinkId, providerOrderId: event.providerOrderId,
      amountPaise: event.amountPaise, currency: event.currency, firstEventId: event.eventId, status: 'review_required', createdAt: now });
    if (!isDeepStrictEqual(planned.attempt, attempt)) tx.update(stored.ref, { attempt: planned.attempt, updatedAt: now });
    return saveEvent(planned.outcome, attempt);
  });
}
