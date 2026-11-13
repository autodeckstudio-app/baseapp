import{readCombinedPaymentBasis}from "../../lib/combined-settlement.js";
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { AuthorizedUser } from '@autodeck/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { ServiceJob, Payment } from '@autodeck/core';
import { COLLECTIONS } from '@autodeck/database';
import { extractUser, assertStudio } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { enforceRateLimit, subjectFrom } from '../../middleware/rateLimit.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { shouldEnforceAppCheck } from '../../lib/environment.js';
import { assertCustomerNotErasing } from '../../lib/customer-erasure-guard.js';
import { readConsultPaymentBinding } from '../../lib/consult-payment.js';
import { prepareJobInvoice } from '../../lib/job-invoice.js';
import { allocateOfflineReceipt } from '../../lib/offline-receipt.js';
const schema=z.object({jobId:z.string().min(1),receiptKey:z.string().regex(/^[a-zA-Z0-9_-]{16,80}$/),receivedPaise:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),method:z.enum(['cash','upi_manual','bank_transfer']),reference:z.string().trim().max(200).default('')}).strict();
/** Actual money received, not a customer/staff UPI claim. No provider call. */
export const recordOfflineReceipt=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);if(!['studio','admin','superadmin'].includes(user.claims.role))throw new HttpsError('permission-denied','Studio or office role required.');
 const data=validate(schema,request.data);
 if(data.method!=='cash'&&!['admin','superadmin'].includes(user.claims.role))throw new HttpsError('permission-denied','Only the office can verify account receipts. Staff can record cash.');
 await enforceRateLimit(subjectFrom(user),'payment.recordManual');
 const db=getFirestore();
 return db.runTransaction(tx=>recordOfflineReceiptInTx(db,tx,user,{...data,reference:data.reference??''}));
});

// Internal runner only. Never exported through functions/index.ts.
export async function recordOfflineReceiptInTx(db:Firestore,tx:Transaction,user:AuthorizedUser,data:z.infer<typeof schema>,reconciliation?:{id:string;paymentId:string}){
 const jobRef=db.collection(COLLECTIONS.jobs()).doc(data.jobId),receiptRef=db.collection('offlineReceipts').doc(data.receiptKey),paymentRef=db.collection(COLLECTIONS.payments()).doc('offline_'+data.jobId);
  const [js,prior]=await Promise.all([tx.get(jobRef),tx.get(receiptRef)]);if(!js.exists)throw new HttpsError('not-found','Job not found.');const job=js.data() as ServiceJob & {offlineSettlement?:{appliedPaise:number;officeReturnDuePaise:number;receiptCount:number}};
  if(job.id!==data.jobId||job.tenantId!==user.claims.tenantId)throw new HttpsError('permission-denied','Job scope could not be verified.');assertStudio(user,job.studioId,'Job');
  if(prior.exists){const p=prior.data()!;if(p.jobId!==data.jobId||p.tenantId!==job.tenantId||p.studioId!==job.studioId||p.customerId!==job.customerId||p.receivedPaise!==data.receivedPaise||p.method!==data.method||p.reference!==data.reference)throw new HttpsError('already-exists','Receipt key belongs to a different receipt.');return{receiptId:receiptRef.id,balanceDuePaise:p.balanceDuePaise,officeReturnDuePaise:p.officeReturnDuePaise,alreadyRecorded:true};}
  const holdId=(job as ServiceJob & {cashReconciliationId?:string}).cashReconciliationId;
  let reconciledPayment:Payment|undefined;
  if(holdId){const hold=(await tx.get(db.collection('cashReconciliations').doc(holdId))).data();
   if(reconciliation){
    if(holdId!==reconciliation.id||!['held','review'].includes(hold?.state)||hold?.paymentId!==reconciliation.paymentId||hold?.receiptKey!==data.receiptKey||hold?.receivedPaise!==data.receivedPaise||hold?.jobId!==job.id||hold?.tenantId!==job.tenantId)throw new HttpsError('failed-precondition','Cash reconciliation binding changed.');
    reconciledPayment=(await tx.get(db.collection(COLLECTIONS.payments()).doc(reconciliation.paymentId))).data() as Payment|undefined;
    if(!reconciledPayment||!['pending','processing','cancelled','failed'].includes(reconciledPayment.status)||reconciledPayment.jobId!==job.id||reconciledPayment.tenantId!==job.tenantId||reconciledPayment.studioId!==job.studioId||reconciledPayment.customerId!==job.customerId||reconciledPayment.razorpayPaymentLinkId!==hold.providerLinkId||reconciledPayment.amount!==hold.expectedAmount||reconciledPayment.currency!==hold.currency||job.totalAmount!==hold.expectedAmount)throw new HttpsError('failed-precondition','Online payment changed. Keep cash held for office review.');
   }else if(hold?.state!=='settled')throw new HttpsError('failed-precondition','Cash reconciliation is held. Do not collect again.');
  }else if(reconciliation)throw new HttpsError('failed-precondition','Cash reconciliation hold missing.');
  await assertCustomerNotErasing(tx,db,job.tenantId,job.customerId);
  if(!['VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY'].includes(job.status)||job.paymentStatus==='paid'||job.paymentStatus==='refunded'||job.settlementKind==='membership_covered')throw new HttpsError('failed-precondition','This job is not open for a receipt.');
  const booking=job.bookingId?(await tx.get(db.collection(COLLECTIONS.bookings()).doc(job.bookingId))).data():undefined;
  if(booking && (booking['id']!==job.bookingId||booking['tenantId']!==job.tenantId||booking['studioId']!==job.studioId||booking['customerId']!==job.customerId||booking['status']==='CANCELLED'||booking['status']==='EXPIRED'||!Number.isSafeInteger(booking['totalAmount'])))throw new HttpsError('failed-precondition','Linked booking scope needs office review.');
  const combinedBasis=await readCombinedPaymentBasis(db,tx,job);
  const pendingWork=await tx.get(db.collection(COLLECTIONS.approvals()).where('jobId','==',job.id).where('status','==','pending').limit(1));
  if(!pendingWork.empty)throw new HttpsError('failed-precondition','An additional-work decision is pending. Review the exact total before recording money.');
  const quoteBinding=await readConsultPaymentBinding(db,tx,job,booking);
  const previousInvoice=await tx.get(db.collection(COLLECTIONS.invoices()).where("jobId","==",job.id).limit(2));
  if(previousInvoice.docs.some(d=>d.data()["status"]!=="void"))throw new HttpsError("failed-precondition","An invoice already exists. Office review is required.");
  const active=await tx.get(db.collection(COLLECTIONS.payments()).where('jobId','==',job.id).where('status','in',['pending','processing','completed']).limit(101));
  if(active.size>100||active.docs.some(d=>d.id!==reconciliation?.paymentId))throw new HttpsError('failed-precondition','An existing payment needs checking first. Do not collect twice.');
  if(booking?.['advancePaymentId']&&!combinedBasis?.advancePaymentId)throw new HttpsError('failed-precondition','An advance payment already exists. Office review is required before another receipt path.');
  if(booking?.cancelIntent?.state==='waiting'||booking?.cancelIntent?.state==='needs_review')throw new HttpsError('failed-precondition','Cancellation payment review is open.');
  const previous=job.offlineSettlement;
  if (previous && (!Number.isSafeInteger(previous.appliedPaise) || !Number.isSafeInteger(previous.officeReturnDuePaise) || previous.officeReturnDuePaise<0 || !Number.isSafeInteger(previous.receiptCount) || previous.receiptCount<1 || previous.receiptCount>=100)) throw new HttpsError("failed-precondition","Receipt history needs office review.");
  const journal=await tx.get(db.collection('offlineReceipts').where('jobId','==',job.id).limit(101));
  if(journal.size>100||journal.size!==(previous?.receiptCount??0))throw new HttpsError('failed-precondition','Receipt history count needs office review.');
  let journalApplied=0;for(const row of journal.docs){const receipt=row.data();if(receipt['tenantId']!==job.tenantId||receipt['studioId']!==job.studioId||receipt['customerId']!==job.customerId||!Number.isSafeInteger(receipt['appliedPaise'])||receipt['appliedPaise']<0)throw new HttpsError('failed-precondition','Receipt history scope needs office review.');journalApplied+=receipt['appliedPaise'];}
  if(!Number.isSafeInteger(journalApplied)||journalApplied!==(previous?.appliedPaise??0))throw new HttpsError('failed-precondition','Receipt history balance needs office review.');
  const allocation=allocateOfflineReceipt(job.totalAmount,(combinedBasis?.advanceCapturedPaise??0)+(previous?.appliedPaise??0),data.receivedPaise),now=new Date().toISOString();
  const appliedPaise=(previous?.appliedPaise??0)+allocation.appliedNowPaise;
  const officeReturnDuePaise=(previous?.officeReturnDuePaise??0)+allocation.officeReturnDuePaise;
  if(!Number.isSafeInteger(officeReturnDuePaise))throw new HttpsError('failed-precondition','Receipt total needs office review.');
  const final=allocation.balanceDuePaise===0;
  const prepared=final?await prepareJobInvoice(db,tx,job,paymentRef.id):null;
  if(prepared&&!prepared.existing&&prepared.invoice.total!==job.totalAmount)throw new HttpsError('failed-precondition','Invoice and job total differ. Office review required.');
  if(prepared?.existing)throw new HttpsError('failed-precondition','Existing invoice needs office review.');
  const invoiceId=prepared&&!prepared.existing?prepared.invoiceRef.id:null;
  const receipt={id:receiptRef.id,tenantId:job.tenantId,studioId:job.studioId,jobId:job.id,bookingId:job.bookingId,customerId:job.customerId,receivedPaise:data.receivedPaise,appliedPaise:allocation.appliedNowPaise,officeReturnDuePaise:allocation.officeReturnDuePaise,balanceDuePaise:allocation.balanceDuePaise,method:data.method,reference:data.reference,recordedBy:user.uid,createdAt:now};
  if(reconciledPayment){tx.update(db.collection(COLLECTIONS.payments()).doc(reconciledPayment.id),{status:'cancelled',cancelledAt:now,cashReconciliationId:reconciliation!.id,updatedAt:now});}
  tx.create(receiptRef,receipt);
  tx.update(jobRef,{offlineSettlement:{appliedPaise,officeReturnDuePaise,receiptCount:(previous?.receiptCount??0)+1},paymentStatus:final?'paid':'partial',...(combinedBasis?{combinedSettlement:{advancePaymentId:combinedBasis.advancePaymentId,advanceCapturedPaise:combinedBasis.advanceCapturedPaise,balanceDuePaise:allocation.balanceDuePaise,settlementPaymentId:final?paymentRef.id:null,settledAt:final?now:null}}:{}),updatedAt:now});
  if(job.bookingId)tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId),{paymentStatus:final?'paid':'partial',updatedAt:now});
  if(prepared&&!prepared.existing){
   if(combinedBasis?.advancePaymentId){prepared.invoice.paymentAllocation={advancePaymentId:combinedBasis.advancePaymentId,advancePaidPaise:combinedBasis.advanceCapturedPaise,settlementPaymentId:paymentRef.id,settlementPaidPaise:combinedBasis.balanceDuePaise};tx.update(db.collection(COLLECTIONS.payments()).doc(combinedBasis.advancePaymentId),{invoiceId:prepared.invoiceRef.id,updatedAt:now});}
   const p:Payment={id:paymentRef.id,tenantId:job.tenantId,studioId:job.studioId,targetType:'job',jobId:job.id,bookingId:job.bookingId,membershipId:null,customerId:job.customerId,amount:combinedBasis?.balanceDuePaise??job.totalAmount,...(combinedBasis?{combinedBasis}:{}),currency:job.priceBreakdown.currency,method:data.method,status:'completed',razorpayPaymentLinkId:null,razorpayPaymentId:null,razorpayOrderId:null,razorpayRefundId:null,refundAmount:null,manualReference:'Actual receipt register',recordedBy:user.uid,invoiceId,providerEventId:null,completedAt:now,failedAt:null,cancelledAt:null,refundedAt:null,createdAt:now,updatedAt:now};
   tx.create(paymentRef,{...p,offlineReceiptSettlement:true,...(quoteBinding?{consultApprovalBindingHash:quoteBinding.approvalBindingHash}:{})});tx.set(prepared.invoiceRef,prepared.invoice);
  }
  if(allocation.officeReturnDuePaise>0)tx.create(db.collection('offlineReturnObligations').doc(receiptRef.id),{id:receiptRef.id,tenantId:job.tenantId,studioId:job.studioId,jobId:job.id,customerId:job.customerId,receiptId:receiptRef.id,amountPaise:allocation.officeReturnDuePaise,status:'due',createdAt:now});
  writeAuditLog(tx,{action:'payment.offline_receipt',entityType:'Payment',entityId:receiptRef.id,user,studioId:job.studioId,after:{receivedPaise:data.receivedPaise,...allocation,invoiceId}});
  return{receiptId:receiptRef.id,invoiceId,balanceDuePaise:allocation.balanceDuePaise,officeReturnDuePaise,alreadyRecorded:false};
}
