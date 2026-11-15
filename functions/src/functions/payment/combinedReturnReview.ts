import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {z} from 'zod';
import type {Booking,Payment} from '@autodeck/core';
import {extractUser,assertRole,assertStudio} from '../../middleware/auth.js';
import {validate} from '../../middleware/validate.js';
import {shouldEnforceAppCheck} from '../../lib/environment.js';
import {writeAuditLog} from '../../middleware/audit.js';
import {enforceRateLimit,subjectFrom} from '../../middleware/rateLimit.js';
import {readCombinedFunding,allocateCombinedReturn,combinedReturnTotals,type CombinedReturn} from '../../lib/combined-return.js';
import {planReserveInTx,applyReserveInTx,type ReservePlan} from '../../lib/refund-outbox.js';
const options={region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()};
const token=(plan:CombinedReturn)=>createHash('sha256').update(JSON.stringify(plan)).digest('hex');
const base=z.object({bookingId:z.string().min(1)}).strict();
function scope(user:ReturnType<typeof extractUser>,b:Booking|undefined){if(!b||b.tenantId!==user.claims.tenantId)throw new HttpsError('permission-denied','Return scope unavailable.');assertStudio(user,b.studioId,'Booking');}
export const getCombinedReturnReview=onCall(options,async request=>{const user=extractUser(request);assertRole(user,'admin','superadmin');const data=validate(base,request.data);await enforceRateLimit(subjectFrom(user),'payment.refund');const b=(await getFirestore().collection('bookings').doc(data.bookingId).get()).data()as Booking&{combinedReturn?:CombinedReturn}|undefined;scope(user,b);return{plan:b!.combinedReturn??null,reviewToken:b!.combinedReturn?token(b!.combinedReturn):null};});
export const approveCombinedReturn=onCall(options,async request=>{
 const user=extractUser(request);assertRole(user,'admin','superadmin');const data=validate(base.extend({reviewToken:z.string().length(64),approved:z.literal(true)}).strict(),request.data);await enforceRateLimit(subjectFrom(user),'payment.refund');const db=getFirestore();
 return db.runTransaction(async tx=>{
  const ref=db.collection('bookings').doc(data.bookingId),b=(await tx.get(ref)).data()as Booking&{combinedReturn?:CombinedReturn}|undefined;scope(user,b);const plan=b!.combinedReturn;if(!plan||b!.status!=='CANCELLED')throw new HttpsError('failed-precondition','No return review is available.');
  if(plan.status!=='awaiting_admin')return{alreadyApproved:true,requestIds:plan.entries.flatMap(e=>e.requestId?[e.requestId]:[])};
  if(token(plan)!==data.reviewToken)throw new HttpsError('failed-precondition','Return review changed. Read the fresh allocation.');
  const funding=await readCombinedFunding(db,tx,b!);if(plan.paidPaise!==funding.paidPaise||!isDeepStrictEqual(plan.entries,allocateCombinedReturn(funding.funding,plan.feePaise)))throw new HttpsError('failed-precondition','Funding changed. Do not approve a stale return.');combinedReturnTotals(plan);
  const reserves:{key:string;plan:Extract<ReservePlan,{ok:true}>}[]=[],manual:{ref:FirebaseFirestore.DocumentReference;key:string;paymentId:string}[]=[];
  for(const e of plan.entries){if(e.returnPaise===0)continue;if(e.method==='razorpay_payment_link'){const payment=funding.sources.get(e.paymentId!);if(!payment)throw new HttpsError('failed-precondition','Original provider payment unavailable.');const reserve=await planReserveInTx(tx,db,{payment,amountPaise:e.returnPaise,reason:plan.reason,createdBy:user.uid,expectedBookingId:b!.id,expectedJobId:payment.jobId,combinedAllocationApproval:{entryKey:e.key}});if(!reserve.ok)throw new HttpsError('failed-precondition',reserve.reason);reserves.push({key:e.key,plan:reserve});}else if(e.paymentId){const marker=db.collection('paymentEvents').doc(`refund_${e.paymentId}`);if((await tx.get(marker)).exists)throw new HttpsError('failed-precondition','An existing manual return blocks approval.');manual.push({ref:marker,key:e.key,paymentId:e.paymentId});}}
  const entries=plan.entries.map(e=>{const r=reserves.find(candidate=>candidate.key===e.key);return{...e,requestId:r?r.plan.request.id:null};});
  for(const r of reserves)applyReserveInTx(tx,r.plan);
  const now=new Date().toISOString();for(const m of manual)tx.create(m.ref,{kind:'combined_manual_return_owed',paymentId:m.paymentId,bookingId:b!.id,entryKey:m.key,claimedBy:user.uid,claimedAt:now});
  const next:CombinedReturn={...plan,entries,status:plan.refundPaise===0?'returned':'approved',approvedBy:user.uid,approvedAt:now};tx.update(ref,{combinedReturn:next,refundStatus:plan.refundPaise===0?'none':'reserved',refundRequestedPaise:entries.filter(e=>e.method==='razorpay_payment_link').reduce((n,e)=>n+e.returnPaise,0),updatedAt:now});
  writeAuditLog(tx,{action:'payment.refund_requested',entityType:'Booking',entityId:b!.id,user,studioId:b!.studioId,after:{refundReviewPaise:plan.refundPaise,feePaise:plan.feePaise,requestIds:reserves.map(r=>r.plan.request.id)}});
  // Durable reservations only. Existing reviewed outbox runner owns provider submission.
  return{alreadyApproved:false,requestIds:reserves.map(r=>r.plan.request.id)};
 });
});
export const settleCombinedManualReturn=onCall(options,async request=>{
 const user=extractUser(request);assertRole(user,'admin','superadmin');const data=validate(base.extend({entryKey:z.string().min(1),reviewToken:z.string().length(64),returned:z.literal(true),note:z.string().trim().min(3).max(500)}).strict(),request.data);await enforceRateLimit(subjectFrom(user),'payment.refund');const db=getFirestore();
 return db.runTransaction(async tx=>{
  const ref=db.collection('bookings').doc(data.bookingId),b=(await tx.get(ref)).data()as Booking&{combinedReturn?:CombinedReturn}|undefined;scope(user,b);const plan=b!.combinedReturn,e=plan?.entries.find(candidate=>candidate.key===data.entryKey);if(!plan||!e||e.method==='razorpay_payment_link'||plan.status==='awaiting_admin'||b!.status!=='CANCELLED')throw new HttpsError('failed-precondition','An approved original-method manual return is required.');
  const recordRef=db.collection('combinedManualReturns').doc(`${b!.id}_${e.key}`),prior=await tx.get(recordRef);if(prior.exists){if(prior.data()?.['note']!==data.note||prior.data()?.['amountPaise']!==e.returnPaise)throw new HttpsError('failed-precondition','Recorded return differs.');return{alreadyReturned:true};}
  if(token(plan)!==data.reviewToken||e.returnPaise<=0||e.returnedPaise!==0)throw new HttpsError('failed-precondition','Return review changed. Refresh before confirming.');
  const jobRef=db.collection('jobs').doc(plan.jobId),job=(await tx.get(jobRef)).data();if(!job||job['tenantId']!==b!.tenantId||job['studioId']!==b!.studioId||job['customerId']!==b!.customerId||job['bookingId']!==b!.id)throw new HttpsError('failed-precondition','Return job binding changed.');
  const paymentRef=e.paymentId?db.collection('payments').doc(e.paymentId):null,p=paymentRef?(await tx.get(paymentRef)).data()as Payment|undefined:undefined;
  if(paymentRef&&(!p||p.tenantId!==b!.tenantId||p.customerId!==b!.customerId||p.studioId!==b!.studioId||p.bookingId!==b!.id||p.jobId!==plan.jobId||p.amount!==e.capturedPaise||p.method!==e.method||p.status!=='completed'||p.refundAmount||p.externalReturnRecordId))throw new HttpsError('failed-precondition','Original manual payment changed.');
  if(e.key.startsWith('receipts_')){const receipts=await tx.get(db.collection('offlineReceipts').where('jobId','==',plan.jobId).limit(101));let actual=0;for(const row of receipts.docs){const r=row.data();if(r['tenantId']!==b!.tenantId||r['studioId']!==b!.studioId||r['customerId']!==b!.customerId||r['bookingId']!==b!.id||r['method']!==e.method||!Number.isSafeInteger(r['appliedPaise'])||r['appliedPaise']<=0)throw new HttpsError('failed-precondition','Original receipt evidence changed.');actual+=r['appliedPaise'];}if(receipts.size>100||receipts.size!==job['offlineSettlement']?.receiptCount||actual!==e.capturedPaise)throw new HttpsError('failed-precondition','Actual receipt ledger no longer reconciles.');}
  const next:CombinedReturn={...plan,entries:plan.entries.map(x=>x.key===e.key?{...x,returnedPaise:e.returnPaise}:x)},totals=combinedReturnTotals(next),now=new Date().toISOString();if(totals.due===0)next.status='returned';
  tx.create(recordRef,{bookingId:b!.id,jobId:plan.jobId,entryKey:e.key,tenantId:b!.tenantId,studioId:b!.studioId,customerId:b!.customerId,method:e.method,amountPaise:e.returnPaise,note:data.note,returnedBy:user.uid,returnedAt:now});
  if(paymentRef)tx.update(paymentRef,{status:e.returnPaise===e.capturedPaise?'refunded':'partially_refunded',refundAmount:e.returnPaise,refundedAt:now,invoiceReviewNeeded:!!p?.invoiceId,updatedAt:now});
  tx.update(ref,{combinedReturn:next,refundedPaise:totals.returned,manualRefundDuePaise:totals.cashDue,paymentStatus:totals.paymentStatus,refundStatus:totals.refundStatus,updatedAt:now});tx.update(jobRef,{paymentStatus:totals.paymentStatus,updatedAt:now});
  writeAuditLog(tx,{action:'payment.offline_returned',entityType:'Payment',entityId:e.paymentId??e.key,user,studioId:b!.studioId,after:{amountPaise:e.returnPaise,method:e.method,note:data.note}});return{alreadyReturned:false};
 });
});
