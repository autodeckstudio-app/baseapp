import{visitCancelHold}from'../../lib/visit-cancel-review.js';
import {z} from 'zod';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {allocateVisitReceipt,combinedCancellationTerms,cancellationTerms,visitCancellationFee} from '@autodeck/core';
import {extractUser,extractCustomerUser,assertRole} from '../../middleware/auth.js';
import {shouldEnforceAppCheck} from '../../lib/environment.js';
import {enforceRateLimit,subjectFrom} from '../../middleware/rateLimit.js';
import {requireCustomerDocId} from '../../lib/customer-identity.js';
import {readVisitBilling} from '../../lib/visit-billing.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const input=z.object({visitId:id,cancelJobId:id.optional(),receiptPaise:z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional()}).strict();
async function read(request:any,self:boolean){
 const user=self?extractCustomerUser(request):extractUser(request);if(self)assertRole(user,'customer');else assertRole(user,'studio','admin','superadmin');
 const d=input.safeParse(request.data);if(!d.success)throw new HttpsError('invalid-argument','Check the visit bill.');
 await enforceRateLimit(subjectFrom(user),'read.jobs');const db=getFirestore(),customerId=self?await requireCustomerDocId(db,'customers',user.claims.tenantId,user.uid):null;
 return db.runTransaction(async tx=>{
  // Check caller scope before reading private original money evidence.
  const v=(await tx.get(db.collection('carVisits').doc(d.data.visitId))).data();
  if(!v||v['tenantId']!==user.claims.tenantId||self&&v['customerId']!==customerId||!self&&user.claims.role==='studio'&&v['studioId']!==user.claims.studioId)throw new HttpsError('not-found','Visit unavailable.');
  if(self){const owner=(await tx.get(db.collection('customers').doc(customerId!))).data();if(!owner||owner['tenantId']!==user.claims.tenantId||owner['authUid']!==user.uid||owner['deletedAt'])throw new HttpsError('not-found','Visit unavailable.');}
  const billing=await readVisitBilling(tx,db,d.data.visitId);let cancellation:null|{feePaise:number;reason:string;hold:string|null;continuingJobIds:string[];visitId:string;revision:number}=null;
  if(d.data.cancelJobId){const target=billing.members.find(m=>m.job.id===d.data.cancelJobId);if(!target||!target.booking||!['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED'].includes(target.job.status))throw new HttpsError('failed-precondition','Work or booking needs cancellation review.');
   const b=target.booking;let categories=b['cancelCategories']??[];if(!categories.length){const svc=(await tx.get(db.collection('services').doc(target.job.serviceId))).data();categories=[String(svc?.['category']??'')];}
   const scheduledAtMs=Date.parse(b['scheduledAt']);if(!Number.isFinite(scheduledAtMs))throw new HttpsError('failed-precondition','Booking time needs review.');
   const terms=b['combinedPayment']?combinedCancellationTerms(target.job.priceBreakdown,{categories,scheduledAtMs,nowMs:Date.now()}):cancellationTerms({categories,totalPaise:target.job.totalAmount,scheduledAtMs,nowMs:Date.now()});
   cancellation={...visitCancellationFee(billing.visit,billing.members.map(m=>m.member),target.job.id,terms.feePaise),hold:visitCancelHold(billing,target.job.id)};
  }
  const allocation=d.data.receiptPaise?allocateVisitReceipt(billing.review,d.data.receiptPaise):null;
  // Project only own-service amounts and lifecycle. Private source, approval,
  // provider and operation evidence stays inside the verified billing reader.
  const returnReviews=billing.returnReviews.map(r=>({jobId:r.jobId,status:r.status,paidPaise:r.paidPaise,retainedPaise:r.retainedPaise,returnPaise:r.returnPaise,returnedPaise:r.returnedPaise,manualDuePaise:r.manualDuePaise,onlineDuePaise:r.onlineDuePaise,accountingReviewNeeded:r.accountingReviewNeeded}));
  return{...billing.review,chargeReviews:billing.chargeReviews.map(c=>c.summary),returnReviews,benefitReviews:billing.benefitReviews,cancellation,allocation,collectionEnabled:false,cancellationEnabled:false};
 });
}
export const getMyVisitBill=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},r=>read(r,true));
export const getStaffVisitBill=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},r=>read(r,false));
