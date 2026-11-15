import type {Firestore,Transaction} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {visitReturnHash} from './visit-service-return-state.js';
const fail=():never=>{throw new HttpsError('failed-precondition','Original online service return needs reconciliation.');};
export type VisitRefundEvidence={id:string;paymentId:string;amountPaise:number;currency:'INR';referenceId:string;status:'processed'|'pending'|'failed'};
export type VisitOnlineReturn={id:string;kind:'visit_original_online_return';tenantId:string;studioId:string;customerId:string;vehicleId:string;visitId:string;jobId:string;bookingId:string;returnId:string;entryKey:string;reviewHash:string;approvalHash:string;providerPaymentId:string;originalReceiptId:string|null;paymentId:string|null;amountPaise:number;captureAmountPaise:number;currency:'INR';state:'reserved'|'submitting'|'review_required'|'returned';candidateId:string|null;evidence:VisitRefundEvidence|null;createdAt:string;createdBy:string;updatedAt:string};
export const visitOnlineReturnId=(returnId:string,entryKey:string)=>'vor_'+visitReturnHash([returnId,entryKey]);
export const visitOnlineReturnCaptureId=(paymentId:string)=>'vrc_'+visitReturnHash(paymentId);
export function exactVisitRefundEvidence(r:VisitOnlineReturn,raw:unknown):VisitRefundEvidence{
 const e=raw as VisitRefundEvidence|null;
 if(!e||typeof e.id!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(e.id)||e.paymentId!==r.providerPaymentId||
   e.amountPaise!==r.amountPaise||e.currency!=='INR'||e.referenceId!==r.id||!['processed','pending','failed'].includes(e.status)||
   r.candidateId!==null&&r.candidateId!==e.id)return fail();
 return{id:e.id,paymentId:e.paymentId,amountPaise:e.amountPaise,currency:'INR',referenceId:e.referenceId,status:e.status};
}
export async function readVisitOnlineReturnClaim(tx:Transaction,db:Firestore,r:VisitOnlineReturn){
 if(r.id!==visitOnlineReturnId(r.returnId,r.entryKey)||r.kind!=='visit_original_online_return'||r.jobId!==r.returnId||
   !Number.isSafeInteger(r.amountPaise)||r.amountPaise<=0||!Number.isSafeInteger(r.captureAmountPaise)||r.captureAmountPaise<r.amountPaise||
   r.currency!=='INR'||!['reserved','submitting','review_required','returned'].includes(r.state)||
   !Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.updatedAt))||typeof r.createdBy!=='string'||!r.createdBy)return fail();
 const guard=(await tx.get(db.collection('visitServiceOnlineReturnCaptures').doc(visitOnlineReturnCaptureId(r.providerPaymentId)))).data();
 if(!guard||guard['providerPaymentId']!==r.providerPaymentId||guard['tenantId']!==r.tenantId||guard['studioId']!==r.studioId||guard['customerId']!==r.customerId||
   guard['currency']!=='INR'||guard['captureAmountPaise']!==r.captureAmountPaise||!Array.isArray(guard['claims'])||guard['claims'].length>121||
   new Set(guard['claims'].map((c:any)=>c.id)).size!==guard['claims'].length||
   guard['claims'].some((c:any)=>typeof c.id!=='string'||!Number.isSafeInteger(c.amountPaise)||c.amountPaise<=0)||
   guard['claims'].reduce((n:number,c:any)=>n+c.amountPaise,0)>r.captureAmountPaise||
   guard['claims'].filter((c:any)=>c.id===r.id&&c.returnId===r.returnId&&c.entryKey===r.entryKey&&c.amountPaise===r.amountPaise&&c.reviewHash===r.reviewHash).length!==1)return fail();
 if(r.candidateId!==null&&(typeof r.candidateId!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(r.candidateId)))return fail();
 if(r.state==='returned'){
  if(!r.candidateId)return fail();
  const evidence=exactVisitRefundEvidence(r,r.evidence);if(evidence.status!=='processed')return fail();
  const identity=(await tx.get(db.collection('visitServiceProviderRefunds').doc('vpr_'+visitReturnHash(evidence.id)))).data();
  if(!identity||identity['requestId']!==r.id||identity['providerPaymentId']!==r.providerPaymentId||identity['amountPaise']!==r.amountPaise||identity['tenantId']!==r.tenantId)return fail();
 }else if(r.evidence!==null)return fail();
 if(r.state==='reserved'&&r.candidateId!==null)return fail();
 return r;
}
