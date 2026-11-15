import {onCall,HttpsError}from'firebase-functions/v2/https';
import{getFirestore}from'firebase-admin/firestore';
import{z}from'zod';
import{extractUser,assertRole,assertStudio}from'../../middleware/auth.js';
import{validate}from'../../middleware/validate.js';
import{shouldEnforceAppCheck}from'../../lib/environment.js';
import{writeAuditLog}from'../../middleware/audit.js';
import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';
const options={region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()};
export const getOfflineReceiptReview=onCall(options,async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');const{jobId}=validate(z.object({jobId:z.string().min(1)}).strict(),request.data);await enforceRateLimit(subjectFrom(user),'payment.confirmManual');const db=getFirestore(),job=(await db.collection('jobs').doc(jobId).get()).data();if(!job||job.tenantId!==user.claims.tenantId)throw new HttpsError('permission-denied','Job scope unavailable.');assertStudio(user,job.studioId,'Job');
 const[receipts,obligations,returns]=await Promise.all(['offlineReceipts','offlineReturnObligations','offlineReturnRecords'].map(c=>db.collection(c).where('jobId','==',jobId).limit(501).get()));
 if([receipts,obligations,returns].some(s=>s!.size>500))throw new HttpsError('resource-exhausted','Receipt history needs office review. No partial register returned.');
 const project=(s:FirebaseFirestore.QuerySnapshot)=>s.docs.map(d=>d.data()).filter(d=>d.tenantId===user.claims.tenantId&&d.studioId===job.studioId);
 return{cancelled:job.status === "CANCELLED",receipts:project(receipts!),obligations:project(obligations!),returns:project(returns!),balanceDuePaise:job.status === "CANCELLED" || job.paymentStatus === "paid" || job.paymentStatus === "refunded" ? 0 : Math.max(0,job.totalAmount-(job.combinedSettlement?.advanceCapturedPaise??0)-(job.offlineSettlement?.appliedPaise??0)),officeReturnDuePaise:job.offlineSettlement?.officeReturnDuePaise??0};
});
export const settleOfflineReturn=onCall(options,async request=>{
 const user=extractUser(request);assertRole(user,'admin','superadmin');const data=validate(z.object({receiptId:z.string().min(1),note:z.string().trim().min(3).max(500),method:z.enum(['cash','upi_manual','bank_transfer'])}).strict(),request.data);await enforceRateLimit(subjectFrom(user),'payment.confirmManual');const db=getFirestore(),ref=db.collection('offlineReturnObligations').doc(data.receiptId),record=db.collection('offlineReturnRecords').doc(data.receiptId);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists||snap.data()?.tenantId!==user.claims.tenantId)throw new HttpsError('permission-denied','Office return unavailable.');const o=snap.data()!;
  if(o.status==='returned'){const prior=(await tx.get(record)).data();if(!prior||prior.tenantId!==o.tenantId||prior.jobId!==o.jobId||prior.amountPaise!==o.amountPaise||prior.note!==data.note||prior.method!==data.method)throw new HttpsError('failed-precondition','Recorded return differs. Review it instead of overwriting.');return{alreadyReturned:true};}
  const jobRef=db.collection('jobs').doc(o.jobId),job=(await tx.get(jobRef)).data();
  if(o.status!=='due'||!job||job.tenantId!==o.tenantId||job.customerId!==o.customerId||job.studioId!==o.studioId||!Number.isSafeInteger(o.amountPaise)||o.amountPaise<=0||!job.offlineSettlement||job.offlineSettlement.officeReturnDuePaise<o.amountPaise)throw new HttpsError('failed-precondition','Return records need office review.');
  const receipt=o.kind==='cancellation'?null:(await tx.get(db.collection("offlineReceipts").doc(data.receiptId))).data();
  const bookingRef=o.kind==='cancellation'?db.collection('bookings').doc(o.bookingId):null;
  const booking=bookingRef?(await tx.get(bookingRef)).data():null;
  if(o.kind==='cancellation' ? (!booking||booking.tenantId!==o.tenantId||booking.customerId!==o.customerId||booking.status!=='CANCELLED'||booking.manualRefundDuePaise!==o.amountPaise) : (!receipt||receipt.jobId!==o.jobId||receipt.tenantId!==o.tenantId))throw new HttpsError("failed-precondition","Return source unavailable.");
  const now=new Date().toISOString();tx.create(record,{id:record.id,receiptId:data.receiptId,jobId:o.jobId,tenantId:o.tenantId,studioId:o.studioId,customerId:o.customerId,amountPaise:o.amountPaise,method:data.method,note:data.note,recordedBy:user.uid,createdAt:now});
  if(bookingRef&&booking)tx.update(bookingRef,{manualRefundDuePaise:0,refundedPaise:(booking.refundedPaise??0)+o.amountPaise,updatedAt:now});
  tx.update(ref,{status:'returned',returnedAt:now});tx.update(jobRef,{offlineSettlement:{...job.offlineSettlement,officeReturnDuePaise:job.offlineSettlement.officeReturnDuePaise-o.amountPaise},updatedAt:now});
  writeAuditLog(tx,{action:'payment.offline_returned',entityType:'Payment',entityId:record.id,user,studioId:o.studioId,after:{amountPaise:o.amountPaise,note:data.note}});return{alreadyReturned:false};
 });
});
