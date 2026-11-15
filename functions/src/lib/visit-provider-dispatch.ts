import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { VerifyWebhookParams } from './payment-provider.js';
import { inspectVisitProviderWebhook } from './visit-provider-webhook.js';
import { recordVerifiedVisitCaptureEvidence } from './visit-provider-capture.js';
import { assertVisitProviderAttempt, type VisitProviderAttempt } from './visit-provider-attempt.js';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
/** Dormant dispatcher, not imported by the live webhook. Incomplete signed
 * money evidence must survive as a private reconciliation hold, not a 200
 * acknowledgement with no durable work. No raw body/customer payload/error
 * text is stored. Unknown identity remains unscoped and private. Review holds
 * have no automatic release, refund, rebilling or invoice-rewrite path. */
export async function dispatchVisitProviderWebhook(db: Firestore, rawBody: string, signature: string, headerEventId: string,
  verify: (input: VerifyWebhookParams) => boolean) {
  const inspected = inspectVisitProviderWebhook(rawBody, signature, headerEventId, verify);
  if (inspected.outcome === 'unrelated') return { outcome: 'unrelated' as const };
  if (inspected.outcome === 'capture') return recordVerifiedVisitCaptureEvidence(db, inspected.evidence);
  let referenceId: string | null = null;
  try {
    const ref: unknown = JSON.parse(rawBody)?.payload?.payment_link?.entity?.reference_id;
    if (typeof ref === 'string' && /^vp_[a-f0-9]{32}$/.test(ref)) referenceId = ref;
  } catch { /* verified but malformed remains private unscoped review */ }
  const payloadHash = hash(rawBody), eventId = /^[A-Za-z0-9_-]{1,120}$/.test(headerEventId) ? headerEventId : payloadHash;
  const ref = db.collection('visitProviderIngressReviews').doc('vir_' + hash(eventId));
  return db.runTransaction(async tx => {
    const existing = (await tx.get(ref)).data();
    if (existing) {
      if (existing['payloadHash'] !== payloadHash || existing['referenceId'] !== referenceId) throw new Error('Provider review event identity conflicts.');
    }
    const capturedEvent = await tx.get(db.collection('visitProviderEvents').doc('ve_' + hash(JSON.stringify(eventId))));
    if (capturedEvent.exists) throw new Error('Provider review conflicts with a capture event identity.');
    const stored = referenceId ? (await tx.get(db.collection('visitProviderAttempts').doc(referenceId))).data() : null;
    let attempt: VisitProviderAttempt | null = null;
    if (stored) {
      attempt = stored['attempt'] as VisitProviderAttempt;
      assertVisitProviderAttempt(attempt);
      if (stored['id'] !== referenceId || attempt.id !== referenceId || ['tenantId','studioId','visitId'].some(k=>stored[k] !== (attempt as any)[k])) throw new Error('Provider review scope needs reconciliation.');
    }
    const headRef = attempt ? db.collection('visitProviderHeads').doc(attempt.visitId) : null;
    const head = headRef ? (await tx.get(headRef)).data() : null;
    if (attempt && (!head || head['attemptId'] !== attempt.id || head['tenantId'] !== attempt.tenantId || head['visitId'] !== attempt.visitId)) throw new Error('Provider review head needs reconciliation.');
    const now = new Date().toISOString();
    if (existing && existing['tenantId'] !== null && (existing['tenantId'] !== attempt?.tenantId || existing['visitId'] !== attempt?.visitId)) throw new Error('Provider original review scope differs.');
    tx.set(ref, { id: ref.id, eventId, payloadHash, referenceId, status: 'review_required', reason: 'incomplete_capture_evidence',
      tenantId: attempt?.tenantId ?? null, studioId: attempt?.studioId ?? null, visitId: attempt?.visitId ?? null, createdAt: existing?.['createdAt'] ?? now });
    if (headRef) tx.update(headRef, { status: 'review_required', updatedAt: now });
    return { outcome: 'review_required' as const, duplicateEvent: !!existing };
  });
}
