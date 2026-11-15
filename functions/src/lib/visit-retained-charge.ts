import type{Firestore,Transaction,DocumentReference}from'firebase-admin/firestore';
import type{AuthorizedUser}from'@autodeck/auth';
import{HttpsError}from'firebase-functions/v2/https';
import{z}from'zod';
import{assertRole}from'../middleware/auth.js';
import{assertCustomerNotErasing}from'./customer-erasure-guard.js';
import{assertConnectedVisitRuntime}from'./connected-visit-release.js';
import{readVisitBilling}from'./visit-billing.js';
import{readVisitRetainedTransportChargeCandidate}from'./visit-service-return-review.js';
import{visitReturnHash}from'./visit-service-return-state.js';
import{writeAuditLog}from'../middleware/audit.js';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),token=z.string().regex(/^[a-f0-9]{64}$/),schema=z.object({visitId:id,jobId:id,operationId:z.string().uuid(),reviewToken:token,note:z.string().trim().min(3).max(500),transport:z.object({reviewToken:token,unusedLegs:z.array(z.enum(['pickup','drop'])).max(2)}).strict(),confirmed:z.literal(true)}).strict();
const fail=():never=>{throw new HttpsError('failed-precondition','Review the original unpaid retained journey charge.');};
/** Compound cancellation and separate original obligation. Only the region
 * where original captured funds remain below fee+trip is accepted here:
 * there is no return to approve, and no partial fee/trip priority is selected.
 * The existing fully funded original-method return path is unchanged. */
export async function cancelVisitRetainedCharge(db:Firestore,user:AuthorizedUser,raw:unknown,retirement?:DocumentReference){
 assertRole(user,'admin','superadmin');assertConnectedVisitRuntime();const p=schema.safeParse(raw);if(!p.success)throw new HttpsError('invalid-argument','Confirm the exact unpaid retained journey cancellation.');const d=p.data;
 return db.runTransaction(async tx=>{
  if(retirement&&(await tx.get(retirement)).exists)throw new HttpsError('failed-precondition','Saved decision was retired. Review again.');
  const visitRef=db.collection('carVisits').doc(d.visitId),v=(await tx.get(visitRef)).data();if(!v||v['id']!==d.visitId||v['tenantId']!==user.claims.tenantId)throw new HttpsError('not-found','Visit unavailable.');await assertCustomerNotErasing(tx,db,v['tenantId'],v['customerId']);
  const rootRef=db.collection('visitCancellationCharges').doc(d.jobId),prior=(await tx.get(rootRef)).data();
  if(prior){if(prior['commandHash']!==visitReturnHash(d)||prior['createdBy']!==user.uid)return fail();const bill=await readVisitBilling(tx,db,d.visitId);if(!bill.chargeReviews.some(c=>c.record['id']===d.jobId))return fail();return{visitId:d.visitId,jobId:d.jobId,alreadyCancelled:true};}
  const c=await readVisitRetainedTransportChargeCandidate(tx,db,d.visitId,d.jobId,Date.now(),d.transport),r=c.returnReview;
  // Exact original transport basis; no fee-first/trip-first attribution under
  // partial funding, no excess/refund, issued-original rewrite or benefit path.
  if(c.candidateToken!==d.reviewToken||r.invoiceId!==null||r.returnPaise!==0||r.paidPaise>=r.feePaise+r.transportRetainedPaise||r.transportRetainedPaise<=0||!r.transport||r.transport.review.needsUnusedLegDecision||c.basis.taxPaise!==0||c.basis.taxRatePercent!==0)return fail();
  const scope=await readVisitBilling(tx,db,d.visitId),target=scope.members.find(m=>m.job.id===d.jobId);if(!target?.booking||target.job.totalAmount<=r.paidPaise)return fail();
  const[retention,oldReturn]=await Promise.all([tx.get(db.collection('visitTransportRetentions').doc(d.jobId)),tx.get(db.collection('visitServiceReturns').doc(d.jobId))]);if(retention.exists||oldReturn.exists)return fail();
  const originalPayments=await tx.get(db.collection('payments').where('bookingId','==',target.job.bookingId).limit(21));if(originalPayments.size>20)return fail();for(const pEntry31 of originalPayments.docs)if(pEntry31.data()['status']==='completed'&&(await tx.get(db.collection('paymentEvents').doc('refund_'+pEntry31.id))).exists)return fail();
  let categories=target.booking['cancelCategories']??[];if(!categories.length){const service=(await tx.get(db.collection('services').doc(target.job.serviceId))).data();categories=[String(service?.['category']??'')];}
  const now=new Date().toISOString(),revision=v['revision']+1;if(!Number.isSafeInteger(revision))return fail();
  const reviewHash=visitReturnHash(r),record={id:d.jobId,version:2,kind:'visit_cancellation_charge',currency:'INR',tenantId:v['tenantId'],studioId:v['studioId'],customerId:v['customerId'],vehicleId:v['vehicleId'],visitId:d.visitId,jobId:d.jobId,bookingId:target.job.bookingId,revision,amountPaise:r.feePaise+r.transportRetainedPaise,feePaise:r.feePaise,transportPaise:r.transportRetainedPaise,originalAppliedPaise:r.paidPaise,moneyToken:c.moneyToken,sourceToken:c.sourceToken,sourceReview:r,basis:c.basis,candidateFunding:c.funding,reviewHash,command:d,commandHash:visitReturnHash(d),planId:'vcc_'+visitReturnHash([v['tenantId'],d.visitId,d.jobId]),categories,scheduledAt:target.booking['scheduledAt'],combinedPayment:!!target.booking['combinedPayment'],reason:d.note,createdAt:now,createdBy:user.uid,cancelledAt:now,cancelledBy:user.uid};
  tx.create(rootRef,{...record,recordHash:visitReturnHash(record)});
  tx.create(db.collection('visitTransportRetentions').doc(d.jobId),{id:d.jobId,kind:'visit_original_transport_retention',tenantId:v['tenantId'],studioId:v['studioId'],customerId:v['customerId'],vehicleId:v['vehicleId'],visitId:d.visitId,jobId:d.jobId,bookingId:target.job.bookingId,planId:record.planId,reviewHash,transportHash:visitReturnHash(r.transport),retainedTransportPaise:r.transportRetainedPaise,createdAt:now,createdBy:user.uid});
  for(const pEntry37 of originalPayments.docs)if(pEntry37.data()['status']==='completed')tx.create(db.collection('paymentEvents').doc('refund_'+pEntry37.id),{kind:'visit_cancellation_charge_owned',paymentId:pEntry37.id,tenantId:v['tenantId'],visitId:d.visitId,jobId:d.jobId,bookingId:target.job.bookingId,chargeId:d.jobId,reviewHash,claimedAt:now});
  tx.update(target.ref,{status:'CANCELLED',visitCancellationChargeId:d.jobId,statusHistory:[...(target.job.statusHistory??[]),{status:'CANCELLED',changedAt:now,changedBy:user.uid,notes:d.note}],updatedAt:now});
  tx.update(db.collection('bookings').doc(target.job.bookingId!),{status:'CANCELLED',visitCancellationChargeId:d.jobId,cancelledAt:now,cancelledBy:'admin',cancelledByUid:user.uid,cancellationReason:d.note,cancellationFeePaise:r.feePaise,cancellationFeeStatus:r.feePaise?'due':'none',visitCancellation:{visitId:d.visitId,reviewToken:r.reviewToken,reason:r.feeReason,continuingJobIds:r.continuingJobIds},updatedAt:now});
  tx.update(visitRef,{revision,updatedAt:now,updatedBy:user.uid});writeAuditLog(tx,{action:'visit.serviceCancelled',entityType:'carVisit',entityId:d.visitId,user,studioId:v['studioId'],after:{jobId:d.jobId,feePaise:r.feePaise,transportPaise:r.transportRetainedPaise,originalAppliedPaise:r.paidPaise,chargeDuePaise:record.amountPaise-r.paidPaise,revision}});
  return{visitId:d.visitId,jobId:d.jobId,alreadyCancelled:false};
 });
}
/** Resolve either existing fully-funded return retention or the distinct
 * no-return unpaid charge. The transport proof remains the same exact original
 * request/choice/custody validator; debt is not inserted into a refund root. */
export async function readVisitRetentionOwner(tx:Transaction,db:Firestore,jobId:string){
 const[refund,charge]=await Promise.all([tx.get(db.collection('visitServiceReturns').doc(jobId)),tx.get(db.collection('visitCancellationCharges').doc(jobId))]);if(refund.exists&&charge.exists)return fail();
 if(charge.exists){const r=charge.data()!;if(r['version']!==2||r['recordHash']!==visitReturnHash({...r,recordHash:undefined})||r['reviewHash']!==visitReturnHash(r['sourceReview']))return fail();return{record:r,review:r['sourceReview']};}
 const r=refund.data();if(!r)return fail();const p=(await tx.get(db.collection('visitServiceReturnPlans').doc(r['planId']))).data();if(!p)return fail();return{record:r,review:p['review']};
}
