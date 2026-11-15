import {createHash} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import type {VerifyWebhookParams} from './payment-provider.js';
import {readIngressOriginalRequest,assertIngressResolved} from './visit-refund-ingress-proof.js';
import {inspectVisitRefundWebhook} from './visit-refund-webhook.js';
import {type VisitOnlineReturn} from './visit-online-return-state.js';
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
  const scope=seen.referenceId?await readIngressOriginalRequest(tx,db,seen.referenceId):null;
  let reason='incomplete_or_unknown_refund';
  if(scope&&seen.outcome==='refund_hint')reason=seen.evidence.paymentId===scope.providerPaymentId&&seen.evidence.amountPaise===scope.amountPaise&&(!scope.candidateId||scope.candidateId===seen.evidence.id)?scope.state==='reserved'?'event_before_committed_submit':'independent_fetch_required':'conflicting_refund_evidence';
  if(prior?.['status']==='reconciled'){
   if(!scope)throw Error('Resolved refund original scope is missing.');
   if(!scope.ingressEventIds?.includes(eventRef.id))throw Error('Original refund event marker is missing.');
   assertIngressResolved(prior,eventRef.id,scope);return{outcome:'reconciled' as const,duplicateEvent:true};
  }
  // A first unbound event can later acquire its proved local scope. A bound
  // event can never be reassigned to another owner or request.
  if(prior?.['tenantId']!==undefined&&prior['tenantId']!==null&&(!scope||['tenantId','studioId','visitId','jobId'].some(k=>prior[k]!==scope![k as keyof VisitOnlineReturn])))throw Error('Original refund event scope changed.');
  const now=new Date().toISOString();
  if(scope&&!scope.ingressEventIds?.includes(eventRef.id)){
   if((scope.ingressEventIds?.length??0)>=2000)throw Error('Refund ingress cap exceeded.');
   tx.update(db.collection('visitServiceOnlineReturns').doc(scope.id),{ingressEventIds:[...(scope.ingressEventIds??[]),eventRef.id]});
  }
  tx.set(eventRef,{id:eventRef.id,eventId:seen.eventId,payloadHash:seen.payloadHash,referenceId:seen.referenceId,
   status:'reconciliation_required',reason,tenantId:scope?.tenantId??null,studioId:scope?.studioId??null,visitId:scope?.visitId??null,jobId:scope?.jobId??null,
   hint:seen.outcome==='refund_hint'?seen.evidence:null,createdAt:prior?.['createdAt']??now,updatedAt:now});
  return{outcome:'reconciliation_required' as const,duplicateEvent:!!prior};
 });
}
