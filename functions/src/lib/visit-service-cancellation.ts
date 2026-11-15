import { isDeepStrictEqual } from 'node:util';
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { AuthorizedUser } from '@autodeck/auth';
import { z } from 'zod';
import { assertRole } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/audit.js';
import { assertCustomerNotErasing } from './customer-erasure-guard.js';
import { readCurrentVisitServiceReturnPlan } from './visit-service-return-plan.js';
import { visitReturnHash } from './visit-service-return-state.js';
const id = z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const schema = z.object({ visitId:id,jobId:id,operationId:z.string().uuid(),reviewToken:z.string().regex(/^[a-f0-9]{64}$/),
  reason:z.string().min(3).max(500).refine(s=>s.trim()===s),reviewed:z.literal(true),cancelled:z.literal(true) }).strict();
const fail = (message='Service cancellation needs a fresh original-method review.'): never => { throw new HttpsError('failed-precondition',message); };

/** DORMANT. No production route imports this writer. Records a reviewed service
 * cancellation and the original-method amount still awaiting Admin approval.
 * Never approves/queues/submits a refund, moves money, edits original payments,
 * receipts, invoices, siblings or physical transport. No benefit restore shortcut.
 * The current supported slice requires paid funding and a fully funded policy
 * fee; fee-due, benefit and transport-anchor decisions remain held. */
export async function cancelReviewedVisitService(db:Firestore,user:AuthorizedUser,raw:unknown) {
  assertRole(user,'admin','superadmin');
  const parsed=schema.safeParse(raw);if(!parsed.success)throw new HttpsError('invalid-argument','Confirm the exact saved service cancellation.');
  const {cancelled:_cancelled,...command}=parsed.data;
  const commandHash=visitReturnHash(command);
  return db.runTransaction(async tx=>{
    const visitRef=db.collection('carVisits').doc(command.visitId),visit=(await tx.get(visitRef)).data();
    if(!visit||visit['id']!==command.visitId||visit['tenantId']!==user.claims.tenantId)throw new HttpsError('not-found','Visit unavailable.');
    await assertCustomerNotErasing(tx,db,visit['tenantId'],visit['customerId']);
    const returnRef=db.collection('visitServiceReturns').doc(command.jobId),prior=(await tx.get(returnRef)).data();
    if(prior){
      if(prior['commandHash']!==commandHash||prior['cancelledBy']!==user.uid||prior['visitId']!==command.visitId||
        prior['tenantId']!==user.claims.tenantId||prior['kind']!=='visit_service_cancellation'||prior['status']!=='awaiting_admin')return fail('Cancellation belongs to another reviewed decision.');
      const saved=(await tx.get(db.collection('visitServiceReturnPlans').doc(prior['planId']))).data();
      if(!saved||saved['commandHash']!==commandHash||!isDeepStrictEqual(saved['command'],command)||saved['reviewHash']!==prior['reviewHash']||
        saved['reviewHash']!==visitReturnHash(saved['review'])||prior['resultHash']!==visitReturnHash(prior['result']))return fail();
      return {...prior['result'],alreadyCancelled:true};
    }
    const plan=await readCurrentVisitServiceReturnPlan(tx,db,user,command),review=plan.review;
    if(review.paidPaise<=0||review.feeDuePaise!==0)return fail('Review the outstanding cancellation fee before changing this service.');
    const jobRef=db.collection('jobs').doc(command.jobId),job=(await tx.get(jobRef)).data();
    if(!job||!job['bookingId'])return fail();
    const bookingRef=db.collection('bookings').doc(job['bookingId']),booking=(await tx.get(bookingRef)).data();
    const pickup=await tx.get(db.collection('pickupRequests').doc(job['bookingId']));
    if(!booking||booking['combinedReturn']||booking['visitServiceReturnId']||job['visitServiceReturnId']||pickup.exists)return fail();
    const now=new Date().toISOString(),revision=visit['revision']+1;
    if(!Number.isSafeInteger(revision))return fail();
    const result={visitId:command.visitId,jobId:command.jobId,revision,returnId:command.jobId,
      feePaise:review.feePaise,retainedPaise:review.retainedPaise,returnReviewPaise:review.returnPaise,
      returnedPaise:0,returnStatus:'awaiting_admin' as const};
    const record={id:command.jobId,kind:'visit_service_cancellation',status:'awaiting_admin',
      tenantId:plan.tenantId,studioId:plan.studioId,customerId:plan.customerId,vehicleId:plan.vehicleId,
      visitId:plan.visitId,jobId:plan.jobId,bookingId:job['bookingId'],revision,
      planId:plan.id,preparedBy:plan.preparedBy,commandHash,reviewHash:plan.reviewHash,
      reason:command.reason,cancelledBy:user.uid,cancelledAt:now,result,resultHash:visitReturnHash(result)};
    tx.create(returnRef,record);
    tx.update(jobRef,{status:'CANCELLED',visitServiceReturnId:record.id,
      statusHistory:[...(job['statusHistory']??[]),{status:'CANCELLED',changedAt:now,changedBy:user.uid,notes:command.reason}],updatedAt:now});
    tx.update(bookingRef,{status:'CANCELLED',visitServiceReturnId:record.id,cancelledAt:now,cancelledBy:'admin',
      cancellationReason:command.reason,cancellationFeePaise:review.feePaise,cancellationFeeStatus:review.feePaise?'collected':'none',
      visitCancellation:{visitId:plan.visitId,reviewToken:command.reviewToken,reason:review.feeReason,continuingJobIds:review.continuingJobIds},
      manualRefundDuePaise:review.entries.filter(e=>e.method!=='razorpay_payment_link').reduce((n,e)=>n+e.returnPaise,0),
      refundedPaise:0,refundStatus:review.returnPaise?'awaiting_approval':'none',updatedAt:now});
    tx.update(visitRef,{revision,updatedBy:user.uid,updatedAt:now});
    writeAuditLog(tx,{action:'visit.serviceCancelled',entityType:'carVisit',entityId:plan.visitId,user,studioId:plan.studioId,
      after:{jobId:plan.jobId,feePaise:review.feePaise,returnReviewPaise:review.returnPaise,returnedPaise:0,revision}});
    return {...result,alreadyCancelled:false};
  });
}
