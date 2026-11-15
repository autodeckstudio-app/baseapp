import{coveredExtrasBreakdown}from'./visit-covered-extras.js';
import{visitReturnHash}from'./visit-service-return-state.js';
import{assertConnectedVisitRuntime}from'./connected-visit-release.js';
import type{Firestore,Transaction}from'firebase-admin/firestore';
import type{Invoice,Customer,Vehicle}from'@autodeck/core';
import{HttpsError}from'firebase-functions/v2/https';
import{buildInvoice}from'./invoice-builder.js';
import{snapshotVehicle}from'./job-invoice.js';
import{resolveServiceName}from'./service-name.js';
import{allocateInvoiceNumber}from'./invoice-counter.js';
import{readVisitBilling}from'./visit-billing.js';
/** A separate identity keeps legacy Invoice.visitId (job identity) intact.
 * Only unissued obligations enter this invoice; older issued originals are
 * referenced by the collection bill, never folded into new taxable revenue. */
export async function prepareVisitInvoice(tx:Transaction,db:Firestore,current:Awaited<ReturnType<typeof readVisitBilling>>,receiptId:string){
 const v=current.visit,invoiceRef=db.collection('visitInvoices').doc('vi_'+receiptId);
 const[prior,customerSnap,vehicleSnap,issuerSnap]=await Promise.all([tx.get(invoiceRef),tx.get(db.collection('customers').doc(v.customerId)),tx.get(db.collection('vehicles').doc(v.vehicleId)),tx.get(db.collection('studioConfig').doc(v.studioId))]);
 if(prior.exists)throw new HttpsError('failed-precondition','Visit invoice identity already exists. Review the original receipt.');
 const customer=customerSnap.data()as Customer,vehicle=vehicleSnap.data()as Vehicle,issuer=issuerSnap.data();
 if(typeof customer.name!=='string'||!customer.name.trim()||['registrationNumber','make','model','color'].some(k=>typeof (vehicle as any)[k]!=='string')||!Number.isSafeInteger(vehicle.year))throw new HttpsError('failed-precondition','Customer or vehicle invoice snapshot needs review.');
 const counter=(await tx.get(db.collection('invoiceCounters').doc(v.tenantId))).data();if(counter&&(counter['tenantId']!==v.tenantId||!Number.isSafeInteger(counter['year'])||!Number.isSafeInteger(counter['nextNumber'])||counter['nextNumber']<1||counter['nextNumber']>=Number.MAX_SAFE_INTEGER))throw new HttpsError('failed-precondition','Invoice number sequence needs office review.');
 const identity=issuer?.['tenantId']===v.tenantId?issuer['invoiceIssuer']:null;if(!identity||['tradeName','legalName','address','phone','email'].some(k=>typeof identity[k]!=='string'||!identity[k].trim())||typeof identity.gstRegistered!=='boolean'||identity.gstRegistered&&(!identity.gstin||typeof identity.gstin!=='string')||!identity.gstRegistered&&identity.gstin)throw new HttpsError('failed-precondition','Invoice issuer snapshot needs office review.');
 const components:{coveredExtrasHash?:string;membershipExtrasHash?:string;jobId:string;bookingId:string|null;amountPaise:number;subtotalPaise:number;discountPaise:number;taxPaise:number;roundOffPaise:number;taxRatePercent:number;taxDescription:string;lineItems:Invoice['lineItems']}[]=[];
 for(const m of current.members){const line=current.review.lines.find(l=>l.jobId===m.job.id)!;if(line.cancelled||line.invoiceId||m.job.totalAmount===0)continue;
  if(m.job.settlementKind&&!current.coveredExtras.has(m.job.id)||m.booking?.['membershipId']&&!current.membershipExtras.has(m.job.id)&&!current.coveredExtras.has(m.job.id)||m.booking?.['giftId'])throw new HttpsError('failed-precondition','Keep the original benefit invoice through its settlement review.');
  if(current.membershipExtras.has(m.job.id)||current.coveredExtras.has(m.job.id))assertConnectedVisitRuntime();
  const approvals=await tx.get(db.collection('approvals').where('jobId','==',m.job.id).where('status','==','approved'));
  const serviceName=await resolveServiceName(db,tx,v.tenantId,m.job.serviceId);
  const part=buildInvoice({invoiceId:'component_'+m.job.id,invoiceNumber:'Component calculation only',tenantId:v.tenantId,studioId:v.studioId,jobId:m.job.id,bookingId:m.job.bookingId,customerId:v.customerId,vehicleId:v.vehicleId,priceBreakdown:current.coveredExtras.has(m.job.id)?coveredExtrasBreakdown(m.job.priceBreakdown):m.job.priceBreakdown,paymentId:null,serviceName,serviceId:m.job.serviceId,additionalWork:approvals.docs.map(d=>d.data()as any)});
  const integers=[part.subtotal,part.discount,part.tax,part.total,part.roundOffPaise??0];
  if(integers.some(n=>!Number.isSafeInteger(n))||part.subtotal<0||part.discount<0||part.tax<0||part.total!==m.job.totalAmount||part.subtotal-part.discount+part.tax+(part.roundOffPaise??0)!==part.total||part.lineItems.some(l=>!Number.isSafeInteger(l.total)||!Number.isSafeInteger(l.unitPrice)||!Number.isSafeInteger(l.quantity)||l.quantity<=0||l.total<0||l.unitPrice<0||l.unitPrice*l.quantity!==l.total)||!Number.isFinite(part.taxRatePercent)||part.taxRatePercent<0)throw new HttpsError('failed-precondition','Original invoice price snapshot needs review.');
  components.push({...(current.coveredExtras.has(m.job.id)?{coveredExtrasHash:visitReturnHash(current.coveredExtras.get(m.job.id)!)}:{}),...(current.membershipExtras.has(m.job.id)?{membershipExtrasHash:visitReturnHash(current.membershipExtras.get(m.job.id)!)}:{}),jobId:m.job.id,bookingId:m.job.bookingId,amountPaise:part.total,subtotalPaise:part.subtotal,discountPaise:part.discount,taxPaise:part.tax,roundOffPaise:part.roundOffPaise??0,taxRatePercent:part.taxRatePercent,taxDescription:part.taxDescription,lineItems:part.lineItems});
 }
 if(!components.length)throw new HttpsError('failed-precondition','No unissued visit obligations remain.');
 const sum=(key:'amountPaise'|'subtotalPaise'|'discountPaise'|'taxPaise'|'roundOffPaise')=>components.reduce((n,c)=>n+c[key],0),totalPaise=sum('amountPaise'),subtotalPaise=sum('subtotalPaise'),discountPaise=sum('discountPaise'),taxPaise=sum('taxPaise'),roundOffPaise=sum('roundOffPaise');
 if(![totalPaise,subtotalPaise,discountPaise,taxPaise,roundOffPaise].every(Number.isSafeInteger)||subtotalPaise-discountPaise+taxPaise+roundOffPaise!==totalPaise)throw new HttpsError('failed-precondition','Combined invoice totals need review.');
 // Last read, followed by counter write. The caller must do no later reads.
 const invoiceNumber=await allocateInvoiceNumber(tx,db,v.tenantId),now=new Date().toISOString();
 return{invoiceRef,invoice:{id:invoiceRef.id,kind:'shared_visit_invoice',status:'issued',tenantId:v.tenantId,studioId:v.studioId,customerId:v.customerId,vehicleId:v.vehicleId,sharedVisitId:v.id,jobIds:components.map(c=>c.jobId),membershipRevision:v.revision,sourceToken:current.review.reviewToken,receiptId,currency:'INR',invoiceNumber,totalPaise,subtotalPaise,discountPaise,taxPaise,roundOffPaise,components,customerSnapshot:{name:customer.name},vehicleSnapshot:snapshotVehicle(vehicle),...(issuer?.['tenantId']===v.tenantId&&issuer['invoiceIssuer']?{issuerSnapshot:structuredClone(issuer['invoiceIssuer'])}:{}),issuedAt:now,createdAt:now}};
}
