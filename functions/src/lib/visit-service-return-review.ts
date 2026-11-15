import {readRetainedTransportProof} from './visit-transport-retention-state.js';
import {readVisitTransportReturnReview} from './visit-transport-return-review.js';
import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { combinedCancellationTerms, cancellationTerms, visitCancellationFee } from '@autodeck/core';
import { readVisitBilling } from './visit-billing.js';
import { readVisitOnlineProof } from './visit-online-proof.js';
import { allocateCombinedReturn } from './combined-return-state.js';
const fail = (): never => { throw new HttpsError('failed-precondition','Original visit return funding needs review.'); };

/** INTERNAL read-only cancellation review, not a cancellation/refund approval.
 * Complete billing proof is checked first. Only the target service's share of
 * each original source is considered; sibling applications remain untouched.
 * No provider call, invoice rewrite, reservation or automatic transport removal.
 * Existing benefit and transport decisions stay explicit blockers. */
export async function readVisitServiceReturnReview(tx: Transaction, db: Firestore, visitId: string, jobId: string, nowMs: number, transportChoice?:{reviewToken:string;unusedLegs:('pickup'|'drop')[]}) {
  const scope = await readVisitBilling(tx,db,visitId), target=scope.members.find(m=>m.job.id===jobId), line=scope.review.lines.find(l=>l.jobId===jobId);
  if (!target || !line || !target.booking || !Number.isFinite(nowMs) || scope.visit.activeHandoverId ||
    !['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED'].includes(target.job.status) || ['CANCELLED','EXPIRED','COMPLETED'].includes(target.booking['status'])) return fail();
  if (target.booking['membershipId'] || target.booking['giftId'] || target.booking['membershipWashUsed']) return fail();
  const hasTransport=scope.visit.transportJobId===jobId||target.member.transportRequested||target.member.pickupFee>0||target.member.dropFee>0;
  const transport=transportChoice?await readVisitTransportReturnReview(tx,db,visitId,jobId,transportChoice.unusedLegs):null;
  if(hasTransport&&!transport||!hasTransport&&transportChoice||transport&&(transport.reviewToken!==transportChoice!.reviewToken||transport.needsUnusedLegDecision||line.appliedPaise!==target.job.totalAmount))return fail();
  const originalRequest=transport?(await tx.get(db.collection('pickupRequests').doc(transport.requestId))).data()!:null;
  let categories=target.booking['cancelCategories']??[];
  if (!categories.length) { const svc=(await tx.get(db.collection('services').doc(target.job.serviceId))).data();categories=[String(svc?.['category']??'')]; }
  const scheduledAtMs=Date.parse(target.booking['scheduledAt']);if(!Number.isFinite(scheduledAtMs)) return fail();
  const policy=(target.booking['combinedPayment']||transport) ? combinedCancellationTerms(target.job.priceBreakdown,{categories,scheduledAtMs,nowMs}) : cancellationTerms({categories,totalPaise:target.job.totalAmount,scheduledAtMs,nowMs});
  const fee=visitCancellationFee(scope.visit,scope.members.map(m=>m.member),jobId,policy.feePaise);
  // A later final-service removal must not strand transport retained by an
  // earlier service cancellation. Re-review unused/future legs explicitly.
  if(!transport&&fee.continuingJobIds.length===0&&scope.visit.transportJobId&&scope.visit.transportJobId!==jobId){
    const anchor=scope.members.find(m=>m.job.id===scope.visit.transportJobId);
    if(anchor?.job.status==='CANCELLED'){
      const retained=(await tx.get(db.collection('visitTransportRetentions').doc(anchor.job.id))).data();
      if(retained){const root=(await tx.get(db.collection('visitServiceReturns').doc(anchor.job.id))).data(),plan=root?(await tx.get(db.collection('visitServiceReturnPlans').doc(root['planId']))).data():null;
        if(!root||!plan)return fail();const transportProof=await readRetainedTransportProof(tx,db,root,plan['review']);
        if(transportProof.physicalState==='open')return fail();}
    }
  }
  const [payments,receipts,online] = await Promise.all([
    tx.get(db.collection('payments').where('bookingId','==',target.job.bookingId).limit(21)),
    tx.get(db.collection('offlineReceipts').where('jobId','==',jobId).limit(101)),
    tx.get(db.collection('visitOnlineApplications').where('jobId','==',jobId).limit(21)),
  ]);
  if(payments.size>20||receipts.size>100||online.size>1)return fail();
  type Source={key:string;paymentId:string|null;method:string;capturedPaise:number;advance:boolean;providerPaymentId:string|null;originalReceiptId:string|null};
  const funding:Source[]=[];
  for(const doc of payments.docs){const p=doc.data();if(p['status']!=='completed'||p['offlineReceiptSettlement'])continue;
    funding.push({key:'payment_'+doc.id,paymentId:doc.id,method:p['method'],capturedPaise:p['amount'],advance:target.booking['advancePaymentId']===doc.id,providerPaymentId:p['razorpayPaymentId']??null,originalReceiptId:null});}
  for(const doc of receipts.docs){const r=doc.data();funding.push({key:'offline_'+doc.id,paymentId:null,method:r['method'],capturedPaise:r['appliedPaise'],advance:false,providerPaymentId:null,originalReceiptId:r['visitReceiptId']??doc.id});}
  for(const doc of online.docs){const a=doc.data(),proof=await readVisitOnlineProof(tx,db,a['receiptId']);
    funding.push({key:'online_'+doc.id,paymentId:null,method:'razorpay_payment_link',capturedPaise:a['appliedPaise'],advance:false,providerPaymentId:proof.capture['providerPaymentId'],originalReceiptId:proof.receipt['id']});}
  const paidPaise=funding.reduce((n,f)=>n+f.capturedPaise,0);
  if(paidPaise!==line.appliedPaise||!Number.isSafeInteger(paidPaise)||funding.some(f=>!Number.isSafeInteger(f.capturedPaise)||f.capturedPaise<=0||f.method==='razorpay_payment_link'&&!f.providerPaymentId))return fail();
  const transportRetainedPaise=transport?.retainedTransportPaise??0;
  const retainedPaise=Math.min(paidPaise,fee.feePaise+transportRetainedPaise),entries=allocateCombinedReturn(funding,retainedPaise).map(e=>({...e,providerPaymentId:funding.find(f=>f.key===e.key)!.providerPaymentId,originalReceiptId:funding.find(f=>f.key===e.key)!.originalReceiptId}));
  const review={visitId,jobId,transport:transport?{review:transport,originalRequest}:null,transportRetainedPaise,moneyToken:scope.moneyTokens.get(jobId)!,sourceToken:scope.review.reviewToken,feePaise:fee.feePaise,feeReason:fee.reason,continuingJobIds:fee.continuingJobIds,paidPaise,retainedPaise,feeDuePaise:Math.max(0,fee.feePaise+transportRetainedPaise-retainedPaise),returnPaise:paidPaise-retainedPaise,invoiceId:line.invoiceId,entries};
  return{...review,reviewToken:createHash('sha256').update(JSON.stringify(review)).digest('hex')};
}
