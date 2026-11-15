import{visitCancelHold}from'../../lib/visit-cancel-review.js';
import{createHash}from'node:crypto';
import{z}from'zod';
import{onCall,HttpsError}from'firebase-functions/v2/https';
import{getFirestore}from'firebase-admin/firestore';
import{combinedCancellationTerms,cancellationTerms,visitCancellationFee,type Booking}from'@autodeck/core';
import{extractUser,assertRole}from'../../middleware/auth.js';
import{shouldEnforceAppCheck}from'../../lib/environment.js';
import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';
import{writeAuditLog}from'../../middleware/audit.js';
import{readVisitBilling}from'../../lib/visit-billing.js';
import{readCancelReads,writeCancelRestores}from'../../lib/cancel-booking.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),schema=z.object({visitId:id,jobId:id,reviewToken:z.string().regex(/^[a-f0-9]{64}$/),operationId:z.string().uuid(),expectedFeePaise:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),reason:z.string().trim().min(3).max(500),confirmed:z.literal(true)}).strict();
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
/** Admin review only. Unfunded non-transport services can be cancelled now;
 * money returns and transport retention require their connected adapters,
 * never a silent use of a single-job refund or pickup-close shortcut. */
export const cancelVisitService=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'admin','superadmin');const parsed=schema.safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Review this visit service before cancellation.');const d=parsed.data;
 await enforceRateLimit(subjectFrom(user),'booking.cancel');const db=getFirestore(),key=hash([user.claims.tenantId,user.uid,d.operationId]),payloadHash=hash(d);
 return db.runTransaction(async tx=>{
  const ref=db.collection('carVisits').doc(d.visitId),v=(await tx.get(ref)).data();if(!v||v['tenantId']!==user.claims.tenantId)throw new HttpsError('not-found','Visit unavailable.');
  const receiptRef=db.collection('visitCancellationReceipts').doc(key),prior=(await tx.get(receiptRef)).data();if(prior){if(prior['payloadHash']!==payloadHash)throw new HttpsError('already-exists','Cancellation operation belongs to another decision.');return{...prior['result'],alreadyCancelled:true};}
  const scope=await readVisitBilling(tx,db,d.visitId);if(scope.review.reviewToken!==d.reviewToken||scope.visit.activeHandoverId)throw new HttpsError('failed-precondition','Visit changed. Review every service again.');
  const target=scope.members.find(m=>m.job.id===d.jobId),line=scope.review.lines.find(l=>l.jobId===d.jobId);
  const hold=visitCancelHold(scope,d.jobId);if(hold||!target?.booking||!line)throw new HttpsError('failed-precondition',hold??'Service unavailable.');
  let categories=target.booking['cancelCategories']??[];if(!categories.length){const svc=(await tx.get(db.collection('services').doc(target.job.serviceId))).data();categories=[String(svc?.['category']??'')];}
  const scheduledAtMs=Date.parse(target.booking['scheduledAt']);if(!Number.isFinite(scheduledAtMs))throw new HttpsError('failed-precondition','Booking time needs review.');
  const terms=target.booking['combinedPayment']?combinedCancellationTerms(target.job.priceBreakdown,{categories,scheduledAtMs,nowMs:Date.now()}):cancellationTerms({categories,totalPaise:target.job.totalAmount,scheduledAtMs,nowMs:Date.now()});
  const fee=visitCancellationFee(scope.visit,scope.members.map(m=>m.member),d.jobId,terms.feePaise);if(fee.feePaise!==d.expectedFeePaise)throw new HttpsError('failed-precondition','Cancellation fee changed. Review this service again.');
  const restores=await readCancelReads(tx,db,target.booking as Booking,target.job.bookingId!);
  const now=new Date().toISOString(),revision=scope.visit.revision+1;if(!Number.isSafeInteger(revision))throw new HttpsError('failed-precondition','Visit revision needs review.');
  const result={visitId:d.visitId,jobId:d.jobId,feePaise:fee.feePaise,feeReason:fee.reason,revision};
  writeCancelRestores(tx,restores,target.booking as Booking,target.job.bookingId!,user,now,'Visit service cancelled');
  tx.update(target.ref,{status:'CANCELLED',statusHistory:[...(target.job.statusHistory??[]),{status:'CANCELLED',changedAt:now,changedBy:user.uid,notes:d.reason}],updatedAt:now});
  tx.update(db.collection('bookings').doc(target.job.bookingId!),{status:'CANCELLED',cancelledAt:now,cancelledBy:'admin',cancellationReason:d.reason,cancellationFeePaise:fee.feePaise,cancellationFeeStatus:fee.feePaise?'due':'none',visitCancellation:{visitId:d.visitId,reviewToken:d.reviewToken,reason:fee.reason,continuingJobIds:fee.continuingJobIds},updatedAt:now});
  // Serializes simultaneous removals: two callers cannot both claim another
  // continuing service from the same obsolete review and waive the final fee.
  tx.update(ref,{revision,updatedAt:now,updatedBy:user.uid});
  tx.create(receiptRef,{payloadHash,tenantId:scope.visit.tenantId,studioId:scope.visit.studioId,result,createdAt:now,createdBy:user.uid});
  writeAuditLog(tx,{action:'visit.serviceCancelled',entityType:'carVisit',entityId:d.visitId,user,studioId:scope.visit.studioId,after:{jobId:d.jobId,feePaise:fee.feePaise,feeReason:fee.reason,continuingJobIds:fee.continuingJobIds,revision}});
  return{...result,alreadyCancelled:false};
 });
});
