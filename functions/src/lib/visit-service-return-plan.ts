import { isDeepStrictEqual } from 'node:util';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { AuthorizedUser } from '@autodeck/auth';
import { z } from 'zod';
import { assertRole } from '../middleware/auth.js';
import { assertCustomerNotErasing } from './customer-erasure-guard.js';
import { readVisitServiceReturnReview } from './visit-service-return-review.js';
import { visitReturnHash as hash } from './visit-service-return-state.js';

const id = z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const commandSchema = z.object({
  visitId: id, jobId: id, operationId: z.string().uuid(),
  reviewToken: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().min(3).max(500).refine(s => s.trim() === s),
  reviewed: z.literal(true),
}).strict();
export type VisitServiceReturnPlanCommand = z.infer<typeof commandSchema>;
type Review = Awaited<ReturnType<typeof readVisitServiceReturnReview>>;
export type VisitServiceReturnPlan = {
  id: string; kind: 'visit_service_return_review'; status: 'review_only';
  tenantId: string; studioId: string; customerId: string; vehicleId: string;
  visitId: string; jobId: string; preparedBy: string; preparedAt: string;
  command: VisitServiceReturnPlanCommand; commandHash: string; review: Review; reviewHash: string;
};
const fail = (message = 'Saved service return review needs checking.'): never => { throw new HttpsError('failed-precondition', message); };
function keyFor(user: AuthorizedUser, operationId: string) { return 'vsr_' + hash([user.claims.tenantId, user.uid, operationId]); }
function commandFor(raw: unknown) {
  const parsed = commandSchema.safeParse(raw);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Review the exact service return first.');
  return parsed.data;
}
async function scopeFor(tx: Transaction, db: Firestore, user: AuthorizedUser, visitId: string) {
  assertRole(user, 'admin', 'superadmin');
  const v = (await tx.get(db.collection('carVisits').doc(visitId))).data();
  if (!v || v['id'] !== visitId || v['tenantId'] !== user.claims.tenantId)
    throw new HttpsError('not-found', 'Visit unavailable.');
  return v;
}
function storedPlan(raw: Record<string, any> | undefined, user: AuthorizedUser, command: VisitServiceReturnPlanCommand, visit: Record<string, any>) {
  if (!raw || raw['id'] !== keyFor(user, command.operationId) || raw['kind'] !== 'visit_service_return_review' ||
    raw['status'] !== 'review_only' || raw['preparedBy'] !== user.uid || !Number.isFinite(Date.parse(raw['preparedAt'])) ||
    ['tenantId','studioId','customerId','vehicleId'].some(k => raw[k] !== visit[k]) ||
    raw['visitId'] !== command.visitId || raw['jobId'] !== command.jobId ||
    !isDeepStrictEqual(raw['command'], command) || raw['commandHash'] !== hash(command)) return fail();
  const review = raw['review'] as Review;
  if (!review || review.visitId !== command.visitId || review.jobId !== command.jobId || review.reviewToken !== command.reviewToken) return fail();
  if (raw['reviewHash'] !== hash(review)) return fail();
  return raw as VisitServiceReturnPlan;
}

/** DORMANT review journal, never a cancellation or refund approval. No route
 * imports this module. Preparing stores only the exact reviewed snapshot. It
 * creates no payment, return request, head/lock, booking transition or invoice.
 * An identical retry can recover its original snapshot after the visit changes;
 * execution MUST call readCurrentVisitServiceReturnPlan in its own transaction.
 * That check is not approval either. Existing Admin refund approval still applies. */
export async function prepareVisitServiceReturnPlan(db: Firestore, user: AuthorizedUser, raw: unknown) {
  assertRole(user, 'admin', 'superadmin');
  const command = commandFor(raw), key = keyFor(user, command.operationId);
  return db.runTransaction(async tx => {
    const visit = await scopeFor(tx, db, user, command.visitId);
    const ref = db.collection('visitServiceReturnPlans').doc(key), prior = await tx.get(ref);
    if (prior.exists) return { plan: storedPlan(prior.data(), user, command, visit), alreadyPrepared: true };
    const review = await readVisitServiceReturnReview(tx, db, command.visitId, command.jobId, Date.now());
    if (review.reviewToken !== command.reviewToken) return fail('Service return changed. Review the original funding again.');
    await assertCustomerNotErasing(tx, db, visit['tenantId'], visit['customerId']);
    const plan: VisitServiceReturnPlan = {
      id: key, kind: 'visit_service_return_review', status: 'review_only',
      tenantId: visit['tenantId'], studioId: visit['studioId'], customerId: visit['customerId'], vehicleId: visit['vehicleId'],
      visitId: command.visitId, jobId: command.jobId, preparedBy: user.uid, preparedAt: new Date().toISOString(),
      command, commandHash: hash(command), review, reviewHash: hash(review),
    };
    tx.create(ref, plan);
    return { plan, alreadyPrepared: false };
  });
}

/** Read-only precondition seam for the eventual approved execution transaction.
 * Call before ANY writes. Exact actor, reason, source identities, fee window,
 * money, membership, work, ownership and transport must still match. */
export async function readCurrentVisitServiceReturnPlan(tx: Transaction, db: Firestore, user: AuthorizedUser, raw: unknown) {
  assertRole(user, 'admin', 'superadmin');
  const command = commandFor(raw), visit = await scopeFor(tx, db, user, command.visitId);
  const snap = await tx.get(db.collection('visitServiceReturnPlans').doc(keyFor(user, command.operationId)));
  const plan = storedPlan(snap.data(), user, command, visit);
  await assertCustomerNotErasing(tx, db, visit['tenantId'], visit['customerId']);
  const current = await readVisitServiceReturnReview(tx, db, command.visitId, command.jobId, Date.now());
  if (!isDeepStrictEqual(current, plan.review)) return fail('Service return changed. Review the original funding again.');
  return plan;
}
