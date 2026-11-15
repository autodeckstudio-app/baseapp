import type{Firestore}from'firebase-admin/firestore';
import type{AuthorizedUser}from'@autodeck/auth';
import{HttpsError}from'firebase-functions/v2/https';
import{assertRole}from'../middleware/auth.js';
import{readVisitBilling}from'./visit-billing.js';
import{readRetainedTransportIssuedProof}from'./visit-retained-transport-issued-proof.js';
import{visitReturnHash}from'./visit-service-return-state.js';
import{renderRetainedTransportInvoicePdf,renderCancellationChargeInvoicePdf}from'./invoice-pdf.js';
const fail=():never=>{throw new HttpsError('not-found','Original charge invoice unavailable.');};
/** Private on-demand derivative of one verified immutable original. No storage,
 * public token, issue rewrite, receipt, provider or money movement. */
export async function readSeparateInvoiceSource(db:Firestore,user:AuthorizedUser,d:{jobId:string;kind:'retained'|'cancellation'}){
 assertRole(user,'customer','studio','admin','superadmin');
 return db.runTransaction(async tx=>{
  const j=(await tx.get(db.collection('jobs').doc(d.jobId))).data();if(!j||j['id']!==d.jobId||j['tenantId']!==user.claims.tenantId||user.claims.role==='studio'&&j['studioId']!==user.claims.studioId||!j['visitId'])return fail();
  const c=(await tx.get(db.collection('customers').doc(j['customerId']))).data();if(!c||c['tenantId']!==user.claims.tenantId||c['deletedAt']||c['erasureState']==='purging'||user.claims.role==='customer'&&c['authUid']!==user.uid)return fail();
  const bill=await readVisitBilling(tx,db,j['visitId']);if(d.kind==='cancellation'){const charge=bill.chargeReviews.find(cEntry17=>cEntry17.record['id']===d.jobId);if(!charge?.invoice||charge.summary.balancePaise!==0)return fail();return{kind:d.kind,invoice:charge.invoice,feePaise:charge.summary.feePaise,transportPaise:charge.summary.transportPaise};}
  const root=(await tx.get(db.collection('visitServiceReturns').doc(d.jobId))).data();if(!root)return fail();const plan=(await tx.get(db.collection('visitServiceReturnPlans').doc(root['planId']))).data();if(!plan)return fail();const proof=await readRetainedTransportIssuedProof(tx,db,root,plan['review'],j['priceBreakdown']);if(!proof)return fail();return{kind:d.kind,invoice:proof.raw,feePaise:proof.invoice.policyFeePaise,transportPaise:proof.invoice.totalPaise-proof.invoice.policyFeePaise};
 });
}
export async function prepareSeparateInvoicePdf(db:Firestore,user:AuthorizedUser,d:{jobId:string;kind:'retained'|'cancellation'}){
 const source=await readSeparateInvoiceSource(db,user,d),pdf=source.kind==='retained'?await renderRetainedTransportInvoicePdf(source.invoice):await renderCancellationChargeInvoicePdf(source.invoice,source.feePaise,source.transportPaise);
 if(pdf.length>750000||pdf.subarray(0,4).toString()!=='%PDF')throw new HttpsError('resource-exhausted','Original invoice PDF exceeds the download limit.');
 // Do not return a derivative if original scope or evidence changed while rendering.
 if(visitReturnHash(await readSeparateInvoiceSource(db,user,d))!==visitReturnHash(source))return fail();
 return{kind:d.kind,jobId:d.jobId,invoiceNumber:source.invoice['invoiceNumber'] as string,mimeType:'application/pdf' as const,base64:pdf.toString('base64')};
}
