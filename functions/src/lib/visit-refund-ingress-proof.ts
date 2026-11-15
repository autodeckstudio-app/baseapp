import{createHash}from'node:crypto';
import type{Firestore,Transaction}from'firebase-admin/firestore';
import{readVisitBilling}from'./visit-billing.js';
import{readVisitOnlineReturnClaim,exactVisitRefundEvidence,type VisitOnlineReturn}from'./visit-online-return-state.js';
import{visitReturnHash}from'./visit-service-return-state.js';
const fail=():never=>{throw Error('Refund ingress needs independently verified original return proof.');};
export const refundIngressId=(eventId:string)=>'vri_'+createHash('sha256').update(eventId).digest('hex');
export async function readIngressOriginalRequest(tx:Transaction,db:Firestore,referenceId:string){
 const raw=(await tx.get(db.collection('visitServiceOnlineReturns').doc(referenceId))).data();if(!raw)return null;
 const r=await readVisitOnlineReturnClaim(tx,db,raw as VisitOnlineReturn),billing=await readVisitBilling(tx,db,r.visitId);
 if(r.id!==referenceId||['tenantId','studioId','customerId','vehicleId'].some(k=>(billing.visit as any)[k]!==r[k as keyof VisitOnlineReturn])||!billing.returnReviews.some(p=>p.jobId===r.jobId&&p.entries.some(e=>e.key===r.entryKey&&e.method==='razorpay_payment_link'&&e.providerPaymentId===r.providerPaymentId&&e.returnPaise===r.amountPaise)))return fail();
 return r;
}
export function assertIngressCanResolve(row:Record<string,any>,docId:string,r:VisitOnlineReturn){
 if(row['id']!==docId||typeof row['eventId']!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(row['eventId'])||docId!==refundIngressId(row['eventId'])||
  typeof row['payloadHash']!=='string'||!/^[a-f0-9]{64}$/.test(row['payloadHash'])||row['referenceId']!==r.id||!r.ingressEventIds?.includes(docId)||
  ['tenantId','studioId','visitId','jobId'].some(k=>row[k]!==r[k as keyof VisitOnlineReturn])||
  !Number.isFinite(Date.parse(row['createdAt']))||!Number.isFinite(Date.parse(row['updatedAt']))||r.state!=='returned'||!r.evidence||!r.candidateId)return fail();
 const hint=exactVisitRefundEvidence(r,row['hint']);if(hint.id!==r.evidence.id)return fail();
}
export function assertIngressResolved(row:Record<string,any>,docId:string,r:VisitOnlineReturn){
 assertIngressCanResolve(row,docId,r);
 if(row['status']!=='reconciled'||row['reason']!=='independently_verified_return'||row['evidenceHash']!==visitReturnHash(r.evidence)||
  row['recognisedAt']!==r.updatedAt||typeof row['resolvedBy']!=='string'||!row['resolvedBy']||!Number.isFinite(Date.parse(row['resolvedAt']))||
  row['updatedAt']!==row['resolvedAt']||row['resolutionHash']!==visitReturnHash({...row,resolutionHash:undefined}))return fail();
}
