import type{Firestore,Transaction}from'firebase-admin/firestore';
import type{ServiceJob}from'@autodeck/core';
import{HttpsError}from'firebase-functions/v2/https';
import{readVisitBilling}from'./visit-billing.js';
/** A shared invoice is not projected into fake one-job invoices/payments. */
export async function assertVisitMemberInvoice(tx:Transaction,db:Firestore,job:ServiceJob,billing?:Awaited<ReturnType<typeof readVisitBilling>>|null){
 if(job.visitInvoiceId){
  if(!job.visitId)throw new HttpsError('failed-precondition','Consolidated invoice visit is missing.');
  const current=billing??await readVisitBilling(tx,db,job.visitId),line=current.review.lines.find(l=>l.jobId===job.id);
  if(current.visit.id!==job.visitId||!line||line.cancelled||line.invoiceId!==job.visitInvoiceId||line.amountPaise!==job.totalAmount||line.appliedPaise!==job.totalAmount||current.review.balancePaise!==0)throw new HttpsError('failed-precondition','Settle and review the full visit invoice before handover.');
  return;
 }
 const invoices=await tx.get(db.collection('invoices').where('jobId','==',job.id).where('status','==','issued').limit(2));
 if(invoices.size!==1||invoices.docs.some(i=>i.data()['tenantId']!==job.tenantId||i.data()['customerId']!==job.customerId||i.data()['vehicleId']!==job.vehicleId||i.data()['total']!==job.totalAmount))throw new HttpsError('failed-precondition','Check every original invoice before handover.');
}
