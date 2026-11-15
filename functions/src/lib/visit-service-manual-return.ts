import type {Firestore,Transaction,DocumentReference} from 'firebase-admin/firestore';
import type {AuthorizedUser} from '@autodeck/auth';
import {HttpsError} from 'firebase-functions/v2/https';
import {z} from 'zod';
import {assertRole} from '../middleware/auth.js';
import {assertCustomerNotErasing} from './customer-erasure-guard.js';
import {writeAuditLog} from '../middleware/audit.js';
import {readVisitBilling} from './visit-billing.js';
import {visitReturnHash} from './visit-service-return-state.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),token=z.string().regex(/^[a-f0-9]{64}$/),note=z.string().min(3).max(500).refine(s=>s.trim()===s);
const base=z.object({visitId:id,jobId:id,progressToken:token,note}).strict();
const fail=(m='Review the exact original-method return again.'):never=>{throw new HttpsError('failed-precondition',m);};
async function current(tx:Transaction,db:Firestore,user:AuthorizedUser,visitId:string,jobId:string){
 const v=(await tx.get(db.collection('carVisits').doc(visitId))).data();
 if(!v||v['id']!==visitId||v['tenantId']!==user.claims.tenantId)throw new HttpsError('not-found','Visit unavailable.');
 await assertCustomerNotErasing(tx,db,v['tenantId'],v['customerId']);
 const scope=await readVisitBilling(tx,db,visitId);if(!Number.isSafeInteger(scope.visit.revision+1))return fail();const progress=scope.returnReviews.find(r=>r.jobId===jobId);
 if(!progress)return fail();
 const record=(await tx.get(db.collection('visitServiceReturns').doc(jobId))).data();if(!record)return fail();
 return{scope,progress,record};
}
/** Explicit Admin approval, never implicit from cancellation. Only local
 * preview routing uses this writer; no provider request/reservation is created.
 * Online entries remain separately owed and unsubmitted. */
export async function approveVisitServiceReturn(db:Firestore,user:AuthorizedUser,raw:unknown,localRetirement?:DocumentReference){
 assertRole(user,'admin','superadmin');const parsed=base.extend({approved:z.literal(true)}).strict().safeParse(raw);
 if(!parsed.success)throw new HttpsError('invalid-argument','Confirm this original-method return approval.');const d=parsed.data;
 return db.runTransaction(async tx=>{
  if(localRetirement&&(await tx.get(localRetirement)).exists)return fail('Saved decision was retired. Review again.');
  const{scope,progress,record}=await current(tx,db,user,d.visitId,d.jobId),ref=db.collection('visitServiceReturnApprovals').doc(d.jobId),prior=(await tx.get(ref)).data();
  if(prior){if(prior['approvedBy']!==user.uid||prior['note']!==d.note||prior['approvedProgressToken']!==d.progressToken)return fail('An existing approval belongs to another exact decision.');return{alreadyApproved:true,returnId:d.jobId,returnedPaise:progress.returnedPaise};}
  if(progress.status!=='awaiting_admin'||progress.progressToken!==d.progressToken)return fail();
  const now=new Date().toISOString(),approval={id:d.jobId,kind:'visit_original_method_approval',
   tenantId:record['tenantId'],studioId:record['studioId'],customerId:record['customerId'],vehicleId:record['vehicleId'],visitId:d.visitId,jobId:d.jobId,bookingId:record['bookingId'],
   reviewHash:record['reviewHash'],planId:record['planId'],returnPaise:progress.returnPaise,approvedBy:user.uid,approvedAt:now,note:d.note,approvedProgressToken:d.progressToken};
  tx.create(ref,{...approval,approvalHash:visitReturnHash(approval)});
  tx.update(db.collection('bookings').doc(record['bookingId']),{refundStatus:progress.returnPaise===0?'none':'approved',updatedAt:now});
  // Serialize against other review-dependent visit actions without repricing.
  tx.update(db.collection('carVisits').doc(d.visitId),{revision:scope.visit.revision+1,updatedBy:user.uid,updatedAt:now});
  writeAuditLog(tx,{action:'visit.returnApproved',entityType:'carVisit',entityId:d.visitId,user,studioId:record['studioId'],after:{jobId:d.jobId,returnPaise:progress.returnPaise,returnedPaise:0,providerSubmitted:false}});
  return{alreadyApproved:false,returnId:d.jobId,returnedPaise:0};
 });
}
/** Actual cash/manual-UPI/bank return confirmation after the separate
 * Admin approval. This records a confirmed external handover, never performs
 * that handover or claims an online capture was returned. Original captured
 * receipts/payments and issued invoices are immutable; tax/accounting remains
 * explicitly review-needed. Exact source entry and note bind retries. */
export async function recordVisitServiceManualReturn(db:Firestore,user:AuthorizedUser,raw:unknown,localRetirement?:DocumentReference){
 assertRole(user,'admin','superadmin');const parsed=base.extend({entryKey:z.string().min(1).max(180),returned:z.literal(true)}).strict().safeParse(raw);
 if(!parsed.success)throw new HttpsError('invalid-argument','Confirm the actual original-method handover.');const d=parsed.data;
 return db.runTransaction(async tx=>{
  if(localRetirement&&(await tx.get(localRetirement)).exists)return fail('Saved decision was retired. Review again.');
  const{scope,progress,record}=await current(tx,db,user,d.visitId,d.jobId),e=progress.entries.find(e=>e.key===d.entryKey);
  if(!e||e.method==='razorpay_payment_link'||e.returnPaise<=0||progress.status==='awaiting_admin')return fail('A separate Admin approval and an original manual source are required.');
  const ref=db.collection('visitServiceManualReturns').doc('vmr_'+visitReturnHash([d.jobId,e.key])),prior=(await tx.get(ref)).data();
  if(prior){if(prior['returnedBy']!==user.uid||prior['note']!==d.note||prior['confirmedProgressToken']!==d.progressToken)return fail('Actual-return confirmation belongs to another decision.');return{alreadyRecorded:true,returnId:d.jobId,entryKey:e.key,amountPaise:e.returnPaise};}
  if(progress.progressToken!==d.progressToken||e.returnedPaise!==0)return fail();
  const approval=(await tx.get(db.collection('visitServiceReturnApprovals').doc(d.jobId))).data();if(!approval)return fail();
  const now=new Date().toISOString(),returnedPaise=progress.returnedPaise+e.returnPaise,manualDuePaise=progress.manualDuePaise-e.returnPaise;
  const actual={id:ref.id,kind:'visit_actual_manual_return',returnId:d.jobId,
   tenantId:record['tenantId'],studioId:record['studioId'],customerId:record['customerId'],vehicleId:record['vehicleId'],visitId:d.visitId,jobId:d.jobId,bookingId:record['bookingId'],
   reviewHash:record['reviewHash'],approvalHash:approval['approvalHash'],entryKey:e.key,amountPaise:e.returnPaise,method:e.method,paymentId:e.paymentId,originalReceiptId:e.originalReceiptId,
   returnedBy:user.uid,returnedAt:now,note:d.note,confirmedProgressToken:d.progressToken,accountingReviewNeeded:true};
  tx.create(ref,{...actual,recordHash:visitReturnHash(actual)});
  tx.update(db.collection('bookings').doc(record['bookingId']),{refundedPaise:returnedPaise,manualRefundDuePaise:manualDuePaise,refundStatus:returnedPaise===progress.returnPaise?'processed':'partially_returned',returnAccountingReviewNeeded:true,updatedAt:now});
  tx.update(db.collection('carVisits').doc(d.visitId),{revision:scope.visit.revision+1,updatedAt:now,updatedBy:user.uid});
  writeAuditLog(tx,{action:'payment.offline_returned',entityType:'carVisit',entityId:d.visitId,user,studioId:record['studioId'],after:{jobId:d.jobId,entryKey:e.key,method:e.method,amountPaise:e.returnPaise,accountingReviewNeeded:true}});
  return{alreadyRecorded:false,returnId:d.jobId,entryKey:e.key,amountPaise:e.returnPaise};
 });
}
