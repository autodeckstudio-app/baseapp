import { readVisitReturnProgress } from './visit-service-return-progress.js';
import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) :
  v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,value]) => [k,canonical(value)])) : v;
export const visitReturnHash = (v: unknown) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const fail = (): never => { throw new HttpsError('failed-precondition', 'Cancelled service original-method review changed.'); };

/** Validate an awaiting-approval cancellation against its immutable saved review
 * and the independently re-read original money. Never treat it as returned cash,
 * approved refund, new funding or permission to rewrite an issued invoice. */
export async function readCancelledVisitReturn(tx: Transaction, db: Firestore, input: {
  visitId: string; jobId: string; booking: Record<string, any>; job: Record<string, any>;
  originalPayments:{id:string;amount:number}[];appliedPaise: number; invoiceId: string | null; moneyToken: string;
}) {
  const { job, booking: b } = input;
  const record = (await tx.get(db.collection('visitServiceReturns').doc(input.jobId))).data();
  if (!record || record['id'] !== input.jobId || record['kind'] !== 'visit_service_cancellation' ||
    record['status'] !== 'awaiting_admin' || record['visitId'] !== input.visitId || record['jobId'] !== input.jobId ||
    record['bookingId'] !== job['bookingId'] || !Number.isSafeInteger(record['revision']) || record['revision'] < 2 ||
    !Number.isFinite(Date.parse(record['cancelledAt'])) || typeof record['cancelledBy'] !== 'string' || !record['cancelledBy'] ||
    ['tenantId','studioId','customerId','vehicleId'].some(k => record[k] !== job[k]) ||
    record['resultHash'] !== visitReturnHash(record['result']) ||
    typeof record['planId'] !== 'string' || !/^vsr_[a-f0-9]{64}$/.test(record['planId'])) return fail();
  const plan = (await tx.get(db.collection('visitServiceReturnPlans').doc(record['planId']))).data();
  const review = plan?.['review'], command = plan?.['command'];
  if (!plan || plan['id'] !== record['planId'] || plan['kind'] !== 'visit_service_return_review' || plan['status'] !== 'review_only' ||
    plan['preparedBy'] !== record['cancelledBy'] || plan['preparedBy'] !== record['preparedBy'] ||
    ['tenantId','studioId','customerId','vehicleId','visitId','jobId'].some(k => plan[k] !== record[k]) ||
    !Number.isFinite(Date.parse(plan['preparedAt'])) || !command || command.reviewed !== true ||
    command.visitId !== input.visitId || command.jobId !== input.jobId || command.reason !== record['reason'] ||
    plan['id'] !== 'vsr_' + visitReturnHash([job['tenantId'], plan['preparedBy'], command.operationId]) ||
    plan['commandHash'] !== visitReturnHash(command) || record['commandHash'] !== plan['commandHash'] ||
    !review || plan['reviewHash'] !== visitReturnHash(review) || record['reviewHash'] !== plan['reviewHash'] ||
    review.reviewToken !== command.reviewToken || review.visitId !== input.visitId || review.jobId !== input.jobId ||
    review.moneyToken !== input.moneyToken || review.paidPaise !== input.appliedPaise || review.invoiceId !== input.invoiceId ||
    b['status'] !== 'CANCELLED' || job['status'] !== 'CANCELLED' || job['visitServiceReturnId'] !== record['id'] ||
    b['visitServiceReturnId'] !== record['id'] || b['cancelledAt'] !== record['cancelledAt'] || b['cancelledBy'] !== 'admin' ||
    b['cancellationReason'] !== command.reason || b['cancellationFeePaise'] !== review.feePaise ||
    b['cancellationFeeStatus'] !== (review.feePaise ? 'collected' : 'none') ||
    b['membershipId'] || b['giftId'] || b['membershipWashUsed'] || b['combinedReturn']) return fail();
  if (!Array.isArray(review.entries) || !review.entries.length || review.entries.some((e: any) => e.returnedPaise !== 0 || e.requestId !== null) ||
    ![review.feePaise,review.paidPaise,review.retainedPaise,review.returnPaise].every(n => Number.isSafeInteger(n) && n >= 0) ||
    review.paidPaise <= 0 || review.feeDuePaise !== 0 || review.retainedPaise !== review.feePaise ||
    review.retainedPaise + review.returnPaise !== review.paidPaise ||
    review.entries.reduce((n: number,e: any) => n + e.capturedPaise,0) !== review.paidPaise) return fail();
  if (new Set(review.entries.map((e: any) => e.key)).size !== review.entries.length ||
    review.entries.some((e: any) => typeof e.key !== 'string' || !e.key ||
      !['cash','upi_manual','bank_transfer','razorpay_payment_link'].includes(e.method) ||
      !Number.isSafeInteger(e.capturedPaise) || e.capturedPaise <= 0 ||
      !Number.isSafeInteger(e.retainedPaise) || e.retainedPaise < 0 ||
      !Number.isSafeInteger(e.returnPaise) || e.returnPaise < 0 ||
      e.retainedPaise + e.returnPaise !== e.capturedPaise ||
      e.method === 'razorpay_payment_link' && (typeof e.providerPaymentId !== 'string' || !e.providerPaymentId)) ||
    review.entries.reduce((n: number,e: any) => n + e.retainedPaise,0) !== review.retainedPaise ||
    review.entries.reduce((n: number,e: any) => n + e.returnPaise,0) !== review.returnPaise) return fail();
  const result = { visitId:input.visitId,jobId:input.jobId,revision:record['revision'],returnId:record['id'],
    feePaise:review.feePaise,retainedPaise:review.retainedPaise,returnReviewPaise:review.returnPaise,
    returnedPaise:0,returnStatus:'awaiting_admin' };
  if(visitReturnHash(result)!==record['resultHash'])return fail();
  for(const p of input.originalPayments){
    const claim=(await tx.get(db.collection('paymentEvents').doc('refund_'+p.id))).data();
    if(!claim||claim['kind']!=='visit_service_return_owned'||claim['reviewHash']!==record['reviewHash']||
      claim['paymentId']!==p.id||claim['returnId']!==record['id']||claim['tenantId']!==record['tenantId']||
      claim['jobId']!==record['jobId']||claim['visitId']!==record['visitId']||claim['bookingId']!==record['bookingId'])return fail();
  }
  const progress=await readVisitReturnProgress(tx,db,record,review);
  if(b['refundStatus']!==progress.refundStatus||b['refundedPaise']!==progress.returnedPaise||b['manualRefundDuePaise']!==progress.manualDuePaise)return fail();
  return { id: record['id'] as string, jobId: input.jobId, status:progress.status,
    paidPaise: review.paidPaise as number, retainedPaise: review.retainedPaise as number,
    returnPaise: review.returnPaise as number, returnedPaise:progress.returnedPaise,manualDuePaise:progress.manualDuePaise,onlineDuePaise:progress.onlineDuePaise,progressToken:progress.progressToken,accountingReviewNeeded:progress.accountingReviewNeeded,entries:progress.entries,invoiceId: input.invoiceId };
}
