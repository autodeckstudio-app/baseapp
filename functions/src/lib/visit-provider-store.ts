import{assertConnectedVisitRuntime}from'./connected-visit-release.js';
import type { PaymentLinkResult } from './payment-provider.js';
import { assertVisitProviderCandidate, sameVisitProviderCandidate } from './visit-provider-recovery.js';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { AuthorizedUser } from '@autodeck/auth';
import { assertRole } from '../middleware/auth.js';
import { readVisitBilling } from './visit-billing.js';
import { assertCustomerNotErasing } from './customer-erasure-guard.js';
import { assertVisitProviderAttempt, planVisitProviderClaim, planVisitProviderLink, planVisitProviderSubmission, planVisitProviderUncertain, type VisitProviderAttempt } from './visit-provider-attempt.js';

/** Dormant internal seam. Not exported as a Cloud Function, no provider calls,
 * no webhook routing and no customer link disclosure. Activation remains off.
 * The eventual callable owns authenticated input, rate limiting and review UI.
 * The eventual captured-money transaction owns receipt/invoice projection.
 * There is intentionally no delete/unlock/recreate shortcut in this seam. */
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const validId = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(s);
const fail = (message = 'Visit provider claim needs review.'): never => { throw new HttpsError('failed-precondition', message); };
type ClaimCommand = { visitId: string; billId: string; reviewToken: string; operationId: string; confirmed: true };
function checkRole(user: AuthorizedUser) { assertRole(user, 'studio', 'admin', 'superadmin'); }
async function readScope(tx: Transaction, db: Firestore, user: AuthorizedUser, visitId: string) {
  checkRole(user);
  if (!validId(visitId)) return fail();
  const visit = (await tx.get(db.collection('carVisits').doc(visitId))).data();
  if (!visit || visit['tenantId'] !== user.claims.tenantId || user.claims.role === 'studio' && visit['studioId'] !== user.claims.studioId)
    throw new HttpsError('not-found', 'Visit unavailable.');
  return visit;
}

export async function claimVisitProviderAttempt(db: Firestore, user: AuthorizedUser, command: ClaimCommand) {
  checkRole(user);
  if (!command || command.confirmed !== true || !validId(command.visitId) || !validId(command.billId) ||
    !/^[a-f0-9]{64}$/.test(command.reviewToken) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.operationId)) return fail();
  // Provider reference_id is capped at 40 characters. A 128-bit digest
  // plus prefix stays within it; the full payload hash still detects collisions.
  // https://razorpay.com/docs/api/payments/payment-links/entity
  const key = 'vp_' + hash([user.claims.tenantId, user.uid, command.operationId]).slice(0,32);
  const payloadHash = hash([command.visitId, command.billId, command.reviewToken, command.operationId, command.confirmed]);
  return db.runTransaction(async tx => {
    const visit = await readScope(tx, db, user, command.visitId);
    const ref = db.collection('visitProviderAttempts').doc(key), headRef = db.collection('visitProviderHeads').doc(command.visitId);
    const [existing, head] = await Promise.all([tx.get(ref), tx.get(headRef)]);
    if (existing.exists) {
      const prior = existing.data()!;
      if (prior['payloadHash'] !== payloadHash || prior['createdBy'] !== user.uid) return fail();
      const attempt = prior['attempt'] as VisitProviderAttempt;
      assertVisitProviderAttempt(attempt);
      if (attempt.tenantId !== visit['tenantId'] || attempt.studioId !== visit['studioId'] || attempt.customerId !== visit['customerId'] || attempt.visitId !== command.visitId || attempt.id !== key || head.data()?.['attemptId'] !== key || head.data()?.['tenantId'] !== visit['tenantId']) return fail();
      return { attempt, alreadyClaimed: true };
    }
    if (head.exists) return fail('An earlier visit payment is unresolved. Do not collect again.');
    const current = await readVisitBilling(tx, db, command.visitId);
    if (current.visit.activeHandoverId || current.review.reviewToken !== command.reviewToken) return fail('Visit changed. Review the whole bill again.');
    await assertCustomerNotErasing(tx, db, current.visit.tenantId, current.visit.customerId);
    const [billSnap, billHead] = await Promise.all([tx.get(db.collection('visitBills').doc(command.billId)), tx.get(db.collection('visitBillHeads').doc(command.visitId))]);
    const bill = billSnap.data(), bHead = billHead.data();
    if (!bill || bill['id'] !== command.billId || bill['kind'] !== 'visit_collection_bill' || bill['status'] !== 'prepared' ||
      ['tenantId','studioId','customerId','vehicleId'].some(k => bill[k] !== (current.visit as any)[k]) ||
      bill['visitId'] !== command.visitId || bill['currency'] !== 'INR' || bill['sourceToken'] !== command.reviewToken ||
      bill['totalPaise'] !== current.review.totalPaise || bill['previouslyAppliedPaise'] !== current.review.appliedPaise || bill['payablePaise'] !== current.review.balancePaise ||
      !isDeepStrictEqual(bill['lines'], current.review.lines) || bHead?.['visitId'] !== command.visitId || bHead['tenantId'] !== current.visit.tenantId || bHead['billId'] !== command.billId || bHead['revision'] !== bill['revision']) return fail('Prepare the current whole-visit bill.');
    if (current.members.some(m => m.job.status !== 'CANCELLED' && (m.job.settlementKind&&!current.coveredExtras.has(m.job.id) || m.booking?.['membershipId']&&!current.membershipExtras.has(m.job.id)&&!current.coveredExtras.has(m.job.id) || m.booking?.['giftId']))) return fail('Benefit settlement needs review before online collection.');
    if(current.membershipExtras.size||current.coveredExtras.size)assertConnectedVisitRuntime();
    const attempt = planVisitProviderClaim({ id: key, tenantId: current.visit.tenantId, studioId: current.visit.studioId, customerId: current.visit.customerId,
      billId: command.billId, reviewToken: command.reviewToken, review: current.review, expectedBalancePaise: current.review.balancePaise });
    const now = new Date().toISOString();
    tx.create(ref, { id: key, tenantId: current.visit.tenantId, studioId: current.visit.studioId, visitId: command.visitId, payloadHash, attempt, createdBy: user.uid, createdAt: now, updatedAt: now });
    tx.create(headRef, { visitId: command.visitId, tenantId: current.visit.tenantId, attemptId: key, createdAt: now });
    return { attempt, alreadyClaimed: false };
  });
}

async function transition<T>(db: Firestore, user: AuthorizedUser, visitId: string, attemptId: string,
  plan: (attempt: VisitProviderAttempt, tx: Transaction, prior: Record<string, any>) => { attempt: VisitProviderAttempt; result: T } | Promise<{ attempt: VisitProviderAttempt; result: T }>): Promise<T> {
  if (!validId(attemptId)) return fail();
  return db.runTransaction(async tx => {
    const visit = await readScope(tx, db, user, visitId), ref = db.collection('visitProviderAttempts').doc(attemptId);
    const [stored, head] = await Promise.all([tx.get(ref), tx.get(db.collection('visitProviderHeads').doc(visitId))]);
    const prior = stored.data(), attempt = prior?.['attempt'] as VisitProviderAttempt;
    if (!prior || prior['createdBy'] !== user.uid || prior['id'] !== attemptId || prior['tenantId'] !== user.claims.tenantId || head.data()?.['tenantId'] !== visit['tenantId'] || head.data()?.['visitId'] !== visitId || head.data()?.['attemptId'] !== attemptId) return fail();
    assertVisitProviderAttempt(attempt);
    if (attempt.id !== attemptId || attempt.visitId !== visitId || attempt.tenantId !== visit['tenantId'] || attempt.studioId !== visit['studioId'] || attempt.customerId !== visit['customerId']) return fail();
    const next = await plan(attempt, tx, prior);
    assertVisitProviderAttempt(next.attempt);
    if (!isDeepStrictEqual(next.attempt, attempt)) tx.update(ref, { attempt: next.attempt, updatedAt: new Date().toISOString() });
    return next.result;
  });
}

/** The caller receives create only after the submitting state commits. A lost
 * response means reconcile, never call begin to get a second create command. */
export function beginVisitProviderSubmission(db: Firestore, user: AuthorizedUser, visitId: string, attemptId: string) {
  return transition(db, user, visitId, attemptId, async (attempt, tx) => {
    if (attempt.state === 'claimed') {
      const current = await readVisitBilling(tx, db, visitId, attemptId);
      if (current.review.reviewToken !== attempt.reviewToken || current.visit.activeHandoverId) return fail('Visit changed before provider submission. Keep the claim for review.');
    }
    const next = planVisitProviderSubmission(attempt); return { attempt: next.attempt, result: next.command };
  });
}
export function markVisitProviderUncertain(db: Firestore, user: AuthorizedUser, visitId: string, attemptId: string) {
  return transition(db, user, visitId, attemptId, attempt => { const next = planVisitProviderUncertain(attempt); return { attempt: next, result: next.state }; });
}
export function bindVisitProviderLink(db: Firestore, user: AuthorizedUser, visitId: string, attemptId: string, evidence: Parameters<typeof planVisitProviderLink>[1]) {
  return transition(db, user, visitId, attemptId, (attempt, _tx, prior) => {
    const candidate = prior['candidate'] as PaymentLinkResult | undefined;
    if (candidate) {
      assertVisitProviderCandidate(candidate);
      if (candidate.providerPaymentLinkId !== evidence.providerLinkId || candidate.paymentUrl !== evidence.paymentUrl ||
        candidate.providerOrderId !== null && candidate.providerOrderId !== evidence.providerOrderId) return fail('Provider candidate conflicts with fetched evidence.');
    }
    const next = planVisitProviderLink(attempt, evidence); return { attempt: next, result: next };
  });
}

/** Internal recovery hint only, never a verified link or customer disclosure.
 * A different create result cannot replace a persisted original candidate. */
export function saveVisitProviderCandidate(db: Firestore, user: AuthorizedUser, visitId: string, attemptId: string, candidate: PaymentLinkResult) {
  assertVisitProviderCandidate(candidate);
  const canonical: PaymentLinkResult = { providerPaymentLinkId: candidate.providerPaymentLinkId, providerOrderId: candidate.providerOrderId, paymentUrl: candidate.paymentUrl };
  return transition(db, user, visitId, attemptId, (attempt, tx, prior) => {
    const original = prior['candidate'] as PaymentLinkResult | undefined;
    if (original) { if (!sameVisitProviderCandidate(original, canonical)) return fail('Original provider candidate needs review.'); }
    else {
      if (!['submitting','uncertain'].includes(attempt.state) || attempt.link) return fail();
      tx.update(db.collection('visitProviderAttempts').doc(attemptId), { candidate: canonical, updatedAt: new Date().toISOString() });
    }
    return { attempt, result: canonical };
  });
}
export function readVisitProviderRecovery(db: Firestore, user: AuthorizedUser, visitId: string, attemptId: string) {
  return transition(db, user, visitId, attemptId, (attempt, _tx, prior) => {
    const candidate = prior['candidate'] as PaymentLinkResult | undefined;
    if (candidate) assertVisitProviderCandidate(candidate);
    return { attempt, result: { attempt, candidate: candidate ?? null } };
  });
}
