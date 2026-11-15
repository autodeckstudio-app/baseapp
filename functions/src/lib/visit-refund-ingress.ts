import {createHash} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import type {VerifyWebhookParams} from './payment-provider.js';
import {readVisitBilling} from './visit-billing.js';
import {inspectVisitRefundWebhook} from './visit-refund-webhook.js';
import {readVisitOnlineReturnClaim,type VisitOnlineReturn} from './visit-online-return-state.js';
/** DORMANT verified-event journal, not live routing. No provider call, refund
 * create, acknowledgement of money returned, approval, reservation release or
 * booking/invoice/payment update. Even an exact processed event remains
 * reconciliation_required until independent original-source fetch qualifies.
 * Incomplete/unknown signed evidence survives privately instead of a silent
 * success. Raw body, payment/customer fields, notes and errors are not stored. */
export async function journalVisitRefundWebhook(db:Firestore,rawBody:string,signature:string,headerEventId:string,verify:(input:VerifyWebhookParams)=>boolean){
 const seen=inspectVisitRefundWebhook(rawBody,signature,headerEventId,verify);
 if(seen.outcome==='unrelated')return{outcome:'unrelated' as const};
 const eventRef=db.collection('visitRefundIngress').doc('vri_'+createHash('sha256').update(seen.eventId).digest('hex'));
 return db.runTransaction(async tx=>{
  const prior=(await tx.get(eventRef)).data();
  if(prior&&(prior['payloadHash']!==seen.payloadHash||prior['eventId']!==seen.eventId||prior['referenceId']!==seen.referenceId))throw Error('Refund event identity conflicts with original evidence.');
  const stored=seen.referenceId?(await tx.get(db.collection('visitServiceOnlineReturns').doc(seen.referenceId))).data():null;
  let scope:VisitOnlineReturn|null=null,reason='incomplete_or_unknown_refund';
  if(stored){
   const r=await readVisitOnlineReturnClaim(tx,db,stored as VisitOnlineReturn);
   if(r.id!==seen.referenceId)throw Error('Refund event request identity needs review.');
   const billing=await readVisitBilling(tx,db,r.visitId);
   if(['tenantId','studioId','customerId','vehicleId'].some(k=>(billing.visit as any)[k]!==r[k as keyof VisitOnlineReturn])||!billing.returnReviews.some(p=>p.jobId===r.jobId&&p.entries.some(e=>e.key===r.entryKey&&e.method==='razorpay_payment_link'&&e.providerPaymentId===r.providerPaymentId&&e.returnPaise===r.amountPaise)))throw Error('Original refund funding proof needs review.');
   scope=r;
   if(seen.outcome==='refund_hint')reason=seen.evidence.paymentId===r.providerPaymentId&&seen.evidence.amountPaise===r.amountPaise&&(!r.candidateId||r.candidateId===seen.evidence.id)?r.state==='reserved'?'event_before_committed_submit':'independent_fetch_required':'conflicting_refund_evidence';
  }
  // A first unbound event can later acquire its proved local scope. A bound
  // event can never be reassigned to another owner or request.
  if(prior?.['tenantId']!==undefined&&prior['tenantId']!==null&&(!scope||['tenantId','studioId','visitId','jobId'].some(k=>prior[k]!==scope![k as keyof VisitOnlineReturn])))throw Error('Original refund event scope changed.');
  const now=new Date().toISOString();
  tx.set(eventRef,{id:eventRef.id,eventId:seen.eventId,payloadHash:seen.payloadHash,referenceId:seen.referenceId,
   status:'reconciliation_required',reason,tenantId:scope?.tenantId??null,studioId:scope?.studioId??null,visitId:scope?.visitId??null,jobId:scope?.jobId??null,
   hint:seen.outcome==='refund_hint'?seen.evidence:null,createdAt:prior?.['createdAt']??now,updatedAt:now});
  return{outcome:'reconciliation_required' as const,duplicateEvent:!!prior};
 });
}
