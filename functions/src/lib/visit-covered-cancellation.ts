import type{Firestore,Transaction,DocumentReference}from'firebase-admin/firestore';
import type{AuthorizedUser}from'@autodeck/auth';
import{cancellationTerms,visitCancellationFee,type ServiceJob}from'@autodeck/core';
import{HttpsError}from'firebase-functions/v2/https';
import{z}from'zod';
import{assertRole}from'../middleware/auth.js';
import{assertCustomerNotErasing}from'./customer-erasure-guard.js';
import{readCoveredLink}from'./membership-covered.js';
import{readVisitBilling}from'./visit-billing.js';
import{visitReturnHash}from'./visit-service-return-state.js';
import{writeAuditLog}from'../middleware/audit.js';
const fail=():never=>{throw new HttpsError('failed-precondition','Review the original covered service before cancelling.');};
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),schema=z.object({visitId:id,jobId:id,reviewToken:z.string().regex(/^[a-f0-9]{64}$/),operationId:z.string().uuid(),reason:z.string().min(3).max(500).refine(s=>s.trim()===s),cancelled:z.literal(true),restoreWash:z.literal(true)}).strict();
const ignored=new Set(['status','statusHistory','updatedAt','membershipWashUsed','visitCoveredCancellationId']);
const financial=(v:Record<string,any>)=>Object.fromEntries(Object.entries(v).filter(([k])=>!ignored.has(k)&&!['cancelledAt','cancelledBy','cancellationReason','cancellationFeePaise','cancellationFeeStatus'].includes(k)));

export async function readVisitCoveredCancellationReview(tx:Transaction,db:Firestore,visitId:string,jobId:string){
  const scope=await readVisitBilling(tx,db,visitId),target=scope.members.find(m=>m.job.id===jobId),line=scope.review.lines.find(l=>l.jobId===jobId);
  if(scope.visit.activeHandoverId||!target?.booking||!line||
    !['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED'].includes(target.job.status)||target.job.settlementKind!=='membership_covered'||
    line.amountPaise!==0||line.appliedPaise!==0||!line.invoiceId||scope.visit.transportJobId===jobId||
    target.member.transportRequested||target.member.pickupFee||target.member.dropFee||target.booking['combinedReturn']||target.booking['visitServiceReturnId'])return fail();
  let categories=target.booking['cancelCategories']??[];if(!categories.length){const service=(await tx.get(db.collection('services').doc(target.job.serviceId))).data();categories=[String(service?.['category']??'')];}
  const scheduledAtMs=Date.parse(target.booking['scheduledAt']);if(!Number.isFinite(scheduledAtMs))return fail();
  const policy=cancellationTerms({categories,totalPaise:0,scheduledAtMs,nowMs:Date.now()}),fee=visitCancellationFee(scope.visit,scope.members.map(m=>m.member),jobId,policy.feePaise);
  if(fee.feePaise>0)return fail();
  const linked=await readCoveredLink(db,tx,target.job),membershipRef=db.collection('memberships').doc(linked.membershipId),membership=(await tx.get(membershipRef)).data();
  const usages=await tx.get(membershipRef.collection('usage').where('jobId','==',jobId).limit(3));
  const pickup=await tx.get(db.collection('pickupRequests').doc(linked.booking.id));
  const original=(await tx.get(db.collection('invoices').doc(line.invoiceId))).data();
  if(!membership||!Number.isSafeInteger(membership['washesUsed'])||membership['washesUsed']<1||usages.size!==1||pickup.exists||!original)return fail();
  const usage=usages.docs[0]!,u=usage.data();if(u['usageType']!=='wash'||u['bookingId']!==linked.booking.id||u['membershipId']!==linked.membershipId)return fail();
  const priorMarker=await tx.get(membershipRef.collection('visitCancellationRestores').doc(jobId));if(priorMarker.exists)return fail();
  return{scope,target,line,linked,membershipRef,membership,usage,u,original,priorMarker};
}

/** DORMANT exact covered-zero cancellation. Restores one proven consumed wash
 * once, never money, gift or pickup benefit. An expired membership stays expired.
 * The issued zero invoice and historical usage row remain immutable, with an
 * explicit separate cancellation marker, not deletion or a recreated usage. */
export async function cancelVisitCoveredService(db:Firestore,user:AuthorizedUser,raw:unknown,localRetirement?:DocumentReference){
 assertRole(user,'admin','superadmin');const parsed=schema.safeParse(raw);if(!parsed.success)throw new HttpsError('invalid-argument','Confirm the exact covered-service cancellation and wash restore.');const d=parsed.data;
 return db.runTransaction(async tx=>{
  if(localRetirement&&(await tx.get(localRetirement)).exists)return fail();
  const v=(await tx.get(db.collection('carVisits').doc(d.visitId))).data();if(!v||v['id']!==d.visitId||v['tenantId']!==user.claims.tenantId)throw new HttpsError('not-found','Visit unavailable.');
  await assertCustomerNotErasing(tx,db,v['tenantId'],v['customerId']);
  const ref=db.collection('visitCoveredCancellations').doc(d.jobId),prior=(await tx.get(ref)).data();
  if(prior){if(prior['commandHash']!==visitReturnHash(d)||prior['cancelledBy']!==user.uid)return fail();return{...prior['result'],alreadyCancelled:true};}
  const{scope,target,line,linked,membershipRef,membership,usage,u,original,priorMarker}=await readVisitCoveredCancellationReview(tx,db,d.visitId,d.jobId);if(scope.review.reviewToken!==d.reviewToken)return fail();
  const now=new Date().toISOString(),revision=scope.visit.revision+1;if(!Number.isSafeInteger(revision))return fail();
  const result={visitId:d.visitId,jobId:d.jobId,membershipId:linked.membershipId,restoredWashes:1,invoiceId:line.invoiceId,revision,returnedPaise:0};
  const saved={id:d.jobId,kind:'visit_covered_cancellation',tenantId:scope.visit.tenantId,studioId:scope.visit.studioId,customerId:scope.visit.customerId,vehicleId:scope.visit.vehicleId,
    visitId:d.visitId,jobId:d.jobId,bookingId:linked.booking.id,membershipId:linked.membershipId,usageId:usage.id,usageHash:visitReturnHash(u),invoiceId:line.invoiceId,invoiceHash:visitReturnHash(original),
    jobHash:visitReturnHash(financial(target.job)),bookingHash:visitReturnHash(financial(target.booking!)),commandHash:visitReturnHash(d),reason:d.reason,cancelledBy:user.uid,cancelledAt:now,result};
  tx.create(ref,saved);tx.create(priorMarker.ref,{jobId:d.jobId,bookingId:linked.booking.id,usageId:usage.id,usageHash:saved.usageHash,tenantId:scope.visit.tenantId,customerId:scope.visit.customerId,restoredWashes:1,createdAt:now,createdBy:user.uid});
  tx.update(membershipRef,{washesUsed:membership['washesUsed']-1,updatedAt:now});
  tx.update(target.ref,{status:'CANCELLED',membershipWashUsed:false,visitCoveredCancellationId:d.jobId,statusHistory:[...(target.job.statusHistory??[]),{status:'CANCELLED',changedAt:now,changedBy:user.uid,notes:d.reason}],updatedAt:now});
  tx.update(db.collection('bookings').doc(linked.booking.id),{status:'CANCELLED',membershipWashUsed:false,visitCoveredCancellationId:d.jobId,cancelledAt:now,cancelledBy:'admin',cancellationReason:d.reason,cancellationFeePaise:0,cancellationFeeStatus:'none',updatedAt:now});
  tx.update(db.collection('carVisits').doc(d.visitId),{revision,updatedAt:now,updatedBy:user.uid});
  writeAuditLog(tx,{action:'membership.wash_restored',entityType:'Membership',entityId:linked.membershipId,user,studioId:scope.visit.studioId,after:{jobId:d.jobId,restoredWashes:1,returnedPaise:0,invoiceUnchanged:true}});
  return{...result,alreadyCancelled:false};
 });
}

/** Historical zero invoice + consumed usage remain verifiable after restore.
 * The membership can have later legitimate usage, so no stale counter equality
 * is used as proof that this particular wash was restored. */
export async function readCancelledCoveredService(tx:Transaction,db:Firestore,job:ServiceJob,booking:Record<string,any>,invoice:Record<string,any>){
 const record=(await tx.get(db.collection('visitCoveredCancellations').doc(job.id))).data();
 if(!record||record['id']!==job.id||record['kind']!=='visit_covered_cancellation'||job.status!=='CANCELLED'||booking['status']!=='CANCELLED'||
   ['tenantId','studioId','customerId','vehicleId','visitId'].some(k=>record[k]!==job[k as keyof ServiceJob])||record['bookingId']!==job.bookingId||
   record['jobHash']!==visitReturnHash(financial(job))||record['bookingHash']!==visitReturnHash(financial(booking))||
   record['invoiceId']!==invoice['id']||record['invoiceHash']!==visitReturnHash(invoice)||
   (job as any).visitCoveredCancellationId!==job.id||booking['visitCoveredCancellationId']!==job.id||
   job.membershipWashUsed!==false||booking['membershipWashUsed']!==false||booking['cancelledAt']!==record['cancelledAt']||
   booking['cancelledBy']!=='admin'||booking['cancellationReason']!==record['reason']||booking['cancellationFeePaise']!==0||booking['cancellationFeeStatus']!=='none')return fail();
 const membershipRef=db.collection('memberships').doc(record['membershipId']),membership=(await tx.get(membershipRef)).data();
 const usage=(await tx.get(membershipRef.collection('usage').doc(record['usageId']))).data(),marker=(await tx.get(membershipRef.collection('visitCancellationRestores').doc(job.id))).data();
 if(!membership||membership['tenantId']!==job.tenantId||membership['customerId']!==job.customerId||!Number.isSafeInteger(membership['washesUsed'])||membership['washesUsed']<0||
   !usage||visitReturnHash(usage)!==record['usageHash']||!marker||marker['jobId']!==job.id||marker['bookingId']!==job.bookingId||marker['usageId']!==record['usageId']||
   marker['usageHash']!==record['usageHash']||marker['tenantId']!==job.tenantId||marker['customerId']!==job.customerId||marker['restoredWashes']!==1||marker['createdAt']!==record['cancelledAt']||marker['createdBy']!==record['cancelledBy'])return fail();
 return{jobId:job.id,membershipId:record['membershipId'],restoredWashes:1,returnedPaise:0};
}
