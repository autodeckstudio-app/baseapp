import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { readVisitBilling } from './visit-billing.js';
import { readVisitOnlineProof } from './visit-online-proof.js';
import { planVisitOnlineReceipt, validateVisitOnlineReceiptProof } from './visit-online-receipt.js';
import { prepareVisitInvoice } from './visit-invoice.js';
import { assertCustomerNotErasing } from './customer-erasure-guard.js';
import { assertVisitProviderAttempt, type VisitProviderAttempt } from './visit-provider-attempt.js';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(value);
const fail=():never=>{throw new HttpsError('failed-precondition','Captured visit payment needs reconciliation. No settlement changed.');};
/** Dormant INTERNAL settlement adapter. No real provider/callable/webhook
 * entry. One capture, one unchanged reviewed bill and complete invoice state
 * commit together. Original capture/attempt evidence remains immutable.
 * Any unresolved extra capture/event blocks this path; no refund is invented. */
export async function settleCapturedVisitPayment(db:Firestore,attemptId:string){
 if(!id(attemptId))return fail();
 return db.runTransaction(async tx=>{
  const stored=await tx.get(db.collection('visitProviderAttempts').doc(attemptId)),raw=stored.data(),attempt=raw?.['attempt']as VisitProviderAttempt;
  if(!raw||raw['id']!==attemptId)return fail();assertVisitProviderAttempt(attempt);
  if(attempt.id!==attemptId||['tenantId','studioId','visitId'].some(k=>raw[k]!== (attempt as any)[k])||!attempt.capture)return fail();
  const headRef=db.collection('visitProviderHeads').doc(attempt.visitId),head=(await tx.get(headRef)).data();
  if(!head||head['visitId']!==attempt.visitId||head['attemptId']!==attempt.id||head['tenantId']!==attempt.tenantId)return fail();
  const[captures,events]=await Promise.all([tx.get(db.collection('visitProviderCaptures').where('attemptId','==',attempt.id).limit(3)),tx.get(db.collection('visitProviderEvents').where('evidence.referenceId','==',attempt.id).limit(101))]);
  if(captures.size!==1||events.size>100||events.empty||events.docs.some(doc=>!['captured_review','duplicate'].includes(doc.data()['outcome'])))return fail();
  const captureDoc=captures.docs[0]!,capture=captureDoc.data(),planned=planVisitOnlineReceipt(attempt,capture);
  if(captureDoc.id!==capture['id'])return fail();
  const originalEvent=events.docs.find(doc=>doc.data()['evidence']?.eventId===capture['firstEventId']);
  if(!originalEvent||originalEvent.id!=='ve_'+hash(capture['firstEventId']))return fail();
  if(head['status']==='settled'){
   if(head['receiptId']!==planned.receipt.id)return fail();
   const proof=await readVisitOnlineProof(tx,db,planned.receipt.id);
   return{receiptId:proof.row.id,invoiceId:proof.row.invoiceId,alreadySettled:true};
  }
  if(head['status']!==undefined)return fail();
  const current=await readVisitBilling(tx,db,attempt.visitId,attempt.id);
  if(current.visit.activeHandoverId||current.review.reviewToken!==attempt.reviewToken||current.review.balancePaise!==attempt.amountPaise)return fail();
  for(const a of planned.applications){const member=current.members.find(m=>m.job.id===a.jobId);if(!member||!['VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY'].includes(member.job.status)||member.job.settlementKind||member.booking?.['membershipId']||member.booking?.['giftId'])return fail();}
  await assertCustomerNotErasing(tx,db,attempt.tenantId,attempt.customerId);
  const receiptRef=db.collection('visitOnlineReceipts').doc(planned.receipt.id),appRefs=planned.applications.map(a=>db.collection('visitOnlineApplications').doc(a.id));
  const[billDoc,priorReceipt,...priorApps]=await Promise.all([tx.get(db.collection('visitBills').doc(attempt.billId)),tx.get(receiptRef),...appRefs.map(ref=>tx.get(ref))]);
  if(priorReceipt.exists||priorApps.some(doc=>doc.exists))return fail();
  // prepareVisitInvoice performs the last transaction reads and then reserves
  // its invoice number. Pure proof validation below may still abort the tx.
  const prepared=await prepareVisitInvoice(tx,db,current,planned.receipt.id);
  const invoice={...prepared.invoice,receiptSource:'visit_online_receipt'};
  validateVisitOnlineReceiptProof({receipt:planned.receipt,applications:planned.applications,attempt,capture,event:originalEvent.data(),bill:billDoc.data(),invoice});
  const now=new Date().toISOString();
  tx.create(receiptRef,planned.receipt);
  planned.applications.forEach((a,i)=>{tx.create(appRefs[i]!,a);const m=current.members.find(m=>m.job.id===a.jobId)!;
   tx.update(m.ref,{paymentStatus:'paid',visitInvoiceId:invoice.id,updatedAt:now});
   if(m.job.bookingId)tx.update(db.collection('bookings').doc(m.job.bookingId),{paymentStatus:'paid',visitInvoiceId:invoice.id,updatedAt:now});
  });
  tx.create(prepared.invoiceRef,invoice);
  tx.update(headRef,{status:'settled',receiptId:planned.receipt.id,settledAt:now});
  tx.update(db.collection('carVisits').doc(attempt.visitId),{updatedAt:now,updatedBy:'system'});
  return{receiptId:planned.receipt.id,invoiceId:invoice.id,alreadySettled:false};
 });
}
