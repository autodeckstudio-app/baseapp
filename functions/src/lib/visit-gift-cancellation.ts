import type{Firestore,Transaction}from'firebase-admin/firestore';
import type{AuthorizedUser}from'@autodeck/auth';
import{cancellationTerms,visitCancellationFee}from'@autodeck/core';
import{HttpsError}from'firebase-functions/v2/https';
import{z}from'zod';
import{assertRole}from'../middleware/auth.js';
import{assertCustomerNotErasing}from'./customer-erasure-guard.js';
import{readVisitBilling}from'./visit-billing.js';
import{visitReturnHash}from'./visit-service-return-state.js';
import{writeAuditLog}from'../middleware/audit.js';
const fail=():never=>{throw new HttpsError('failed-precondition','Original gift redemption needs Admin review.');};
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),schema=z.object({visitId:id,jobId:id,reviewToken:z.string().regex(/^[a-f0-9]{64}$/),operationId:z.string().uuid(),reason:z.string().min(3).max(500).refine(s=>s.trim()===s),cancelled:z.literal(true),reviewedGift:z.literal(true)}).strict();
/** DORMANT private read-only review. Buyer funding is evidence for restoring
 * the original gift, never the recipient's new receipt or a gift refund. */
export async function readVisitGiftCancellationReview(tx:Transaction,db:Firestore,visitId:string,jobId:string){
 const scope=await readVisitBilling(tx,db,visitId),target=scope.members.find(m=>m.job.id===jobId),line=scope.review.lines.find(l=>l.jobId===jobId);
 if(!target?.booking||!line||scope.visit.activeHandoverId||!['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED'].includes(target.job.status)||
   !target.booking['giftId']||target.booking['membershipId']||target.booking['membershipWashUsed']||target.job.totalAmount!==0||target.job.additionalWorkDelta||
   line.appliedPaise!==0||line.invoiceId||target.job.settlementKind||target.member.transportRequested||target.member.pickupFee||target.member.dropFee||scope.visit.transportJobId===jobId)return fail();
 const giftId=target.booking['giftId'],gift=(await tx.get(db.collection('gifts').doc(giftId))).data(),pickup=await tx.get(db.collection('pickupRequests').doc(target.job.bookingId!));
 if(pickup.exists||!gift||gift['id']!==giftId||gift['tenantId']!==scope.visit.tenantId||gift['serviceId']!==target.job.serviceId||gift['bookingId']!==target.job.bookingId||
   gift['claimedBy']!==scope.visit.customerId||gift['redeemedBy']!==scope.visit.customerId||!['REDEEMED','VOID','REFUNDED'].includes(gift['status'])||
   typeof gift['paymentId']!=='string'||!Number.isFinite(Date.parse(gift['purchasedAt']))||!Number.isFinite(Date.parse(gift['expiresAt'])))return fail();
 const payment=(await tx.get(db.collection('payments').doc(gift['paymentId']))).data(),payments=await tx.get(db.collection('payments').where('giftId','==',giftId).limit(3));
 if(!payment||payments.size!==1||payments.docs[0]!.id!==gift['paymentId']||payment['id']!==gift['paymentId']||payment['giftId']!==giftId||
   payment['tenantId']!==scope.visit.tenantId||payment['customerId']!==gift['buyerId']||payment['amount']!==gift['amountPaise']||payment['currency']!=='INR'||
   !Number.isSafeInteger(payment['amount'])||payment['amount']<=0||!['completed','refunded','partially_refunded'].includes(payment['status']))return fail();
 const[refunds,claim]=await Promise.all([
  tx.get(db.collection('refundRequests').where('paymentId','==',payment['id']).limit(22)),
  tx.get(db.collection('paymentEvents').doc('refund_'+payment['id'])),
 ]);
 if(refunds.size>21||refunds.docs.some(d=>!['projected','failed'].includes(d.data()['status'])))return fail();
 const hasReturned=payment['status']!=='completed'||(payment['refundAmount']??0)>0||payment['refundedAt']||payment['razorpayRefundId'];
 const restore=gift['status']==='REDEEMED'&&!hasReturned;
 if(restore&&(gift['refundRequested']||claim.exists||payment['externalReturnRecordId']||refunds.docs.some(d=>d.data()['status']!=='failed')))return fail();
 if(payment['externalReturnRecordId'])return fail(); // unknown external handover is not proof to revive credit
 if(gift['status']==='REFUNDED'&&!hasReturned)return fail();
 let categories=target.booking['cancelCategories']??[];if(!categories.length){const svc=(await tx.get(db.collection('services').doc(target.job.serviceId))).data();categories=[String(svc?.['category']??'')];}
 const scheduledAtMs=Date.parse(target.booking['scheduledAt']);if(!Number.isFinite(scheduledAtMs))return fail();
 const terms=cancellationTerms({categories,totalPaise:0,scheduledAtMs,nowMs:Date.now()}),fee=visitCancellationFee(scope.visit,scope.members.map(m=>m.member),jobId,terms.feePaise);if(fee.feePaise>0)return fail();
 const decision=restore?'restore_original_gift':hasReturned?'keep_refunded':'keep_void';
 const evidence={visitId,jobId,bookingId:target.job.bookingId!,giftId,billToken:scope.review.reviewToken,giftHash:visitReturnHash(gift),paymentHash:visitReturnHash(payment),refundsHash:visitReturnHash(refunds.docs.map(d=>({id:d.id,...d.data()}))),decision,feePaise:0,returnedPaise:0};
 return{...evidence,reviewToken:visitReturnHash(evidence)};
}
/** DORMANT zero-recipient-money cancellation. No buyer refund, new cash
 * receipt, new expiry, different recipient or benefit substitution. */
export async function cancelVisitGiftService(db:Firestore,user:AuthorizedUser,raw:unknown){
 assertRole(user,'admin','superadmin');const parsed=schema.safeParse(raw);if(!parsed.success)throw new HttpsError('invalid-argument','Confirm the exact gift-service cancellation.');const d=parsed.data;
 return db.runTransaction(async tx=>{
  const v=(await tx.get(db.collection('carVisits').doc(d.visitId))).data();if(!v||v['id']!==d.visitId||v['tenantId']!==user.claims.tenantId)throw new HttpsError('not-found','Visit unavailable.');
  await assertCustomerNotErasing(tx,db,v['tenantId'],v['customerId']);
  const ref=db.collection('visitGiftCancellations').doc(d.jobId),prior=(await tx.get(ref)).data();if(prior){if(prior['commandHash']!==visitReturnHash(d)||prior['cancelledBy']!==user.uid)return fail();return{...prior['result'],alreadyCancelled:true};}
  const review=await readVisitGiftCancellationReview(tx,db,d.visitId,d.jobId);if(review.reviewToken!==d.reviewToken)return fail();
  const jobRef=db.collection('jobs').doc(d.jobId),job=(await tx.get(jobRef)).data()!,giftRef=db.collection('gifts').doc(review.giftId),gift=(await tx.get(giftRef)).data()!;
  const now=new Date().toISOString(),revision=v['revision']+1;if(!Number.isSafeInteger(revision))return fail();
  const result={visitId:d.visitId,jobId:d.jobId,giftId:review.giftId,decision:review.decision,restoredGift:review.decision==='restore_original_gift',returnedPaise:0,revision};
  tx.create(ref,{id:d.jobId,kind:'visit_gift_cancellation',tenantId:v['tenantId'],studioId:v['studioId'],customerId:v['customerId'],vehicleId:v['vehicleId'],visitId:d.visitId,jobId:d.jobId,commandHash:visitReturnHash(d),review,reason:d.reason,cancelledBy:user.uid,cancelledAt:now,result});
  if(review.decision==='restore_original_gift')tx.update(giftRef,{status:'ACTIVE',redeemedBy:null,redeemedAt:null,bookingId:null});
  else if(review.decision==='keep_refunded'&&gift['status']!=='REFUNDED')tx.update(giftRef,{status:'REFUNDED',voidedAt:now,voidReason:'Original gift funding already returned'});
  tx.update(jobRef,{status:'CANCELLED',visitGiftCancellationId:d.jobId,statusHistory:[...(job['statusHistory']??[]),{status:'CANCELLED',changedAt:now,changedBy:user.uid,notes:d.reason}],updatedAt:now});
  tx.update(db.collection('bookings').doc(review.bookingId),{status:'CANCELLED',visitGiftCancellationId:d.jobId,cancelledAt:now,cancelledBy:'admin',cancellationReason:d.reason,cancellationFeePaise:0,cancellationFeeStatus:'none',updatedAt:now});
  tx.update(db.collection('carVisits').doc(d.visitId),{revision,updatedAt:now,updatedBy:user.uid});
  writeAuditLog(tx,{action:result.restoredGift?'gift.restored':'gift.restore_skipped',entityType:'Gift',entityId:review.giftId,user,studioId:v['studioId'],after:{jobId:d.jobId,decision:review.decision,returnedPaise:0}});
  return{...result,alreadyCancelled:false};
 });
}
