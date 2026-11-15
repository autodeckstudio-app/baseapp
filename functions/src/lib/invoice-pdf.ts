import{renderHouseInvoicePdf}from'./invoice-house-pdf.js';
import {parseRetainedTransportInvoiceSnapshot} from './visit-retained-transport-invoice-snapshot.js';
import {invoiceIssuerProblem,nearestRupeePaise,parseVisitInvoiceRead,type Invoice} from '@autodeck/core';
export class InvoicePdfReview extends Error {}
type PdfRenderSnapshot=Pick<Invoice,'invoiceNumber'|'issuerSnapshot'|'customerSnapshot'|'status'|'issuedAt'|'lineItems'|'subtotal'|'discount'|'tax'|'total'|'roundOffPaise'|'settlementKind'|'membershipId'>&{vehicleSnapshot?:{make:string;model:string;registrationNumber:string}|null};
type PdfCheckSnapshot=PdfRenderSnapshot&Pick<Invoice,'currency'|'taxRatePercent'|'taxDescription'>;
/** Issue-time snapshots only. Missing identity or inconsistent tax is held, never repaired from current data. */
export function assertInvoicePdfReady(inv:PdfCheckSnapshot):void{
 const problem=invoiceIssuerProblem(inv.issuerSnapshot);if(problem)throw new InvoicePdfReview(problem);
 if(!['issued','paid'].includes(inv.status)||!inv.issuedAt||!Number.isFinite(Date.parse(inv.issuedAt)))throw new InvoicePdfReview('Invoice has no supported issued state.');
 if(!inv.customerSnapshot?.name||!inv.vehicleSnapshot)throw new InvoicePdfReview('Customer or vehicle snapshot is missing.');
 if(inv.currency!=='INR'||!inv.lineItems.length||inv.lineItems.some(l=>!Number.isSafeInteger(l.quantity)||l.quantity<=0||!Number.isSafeInteger(l.unitPrice)||l.unitPrice<0||!Number.isSafeInteger(l.total)||l.total!==l.quantity*l.unitPrice))throw new InvoicePdfReview('Invoice line snapshots are inconsistent.');
 if([inv.subtotal,inv.discount,inv.tax,inv.total].some(n=>!Number.isSafeInteger(n)||n<0)||inv.lineItems.reduce((s,l)=>s+l.total,0)!==inv.subtotal||inv.discount>inv.subtotal||inv.subtotal-inv.discount+inv.tax+(inv.roundOffPaise??0)!==inv.total||!Number.isSafeInteger(inv.roundOffPaise??0)||Math.abs(inv.roundOffPaise??0)>50)throw new InvoicePdfReview('Invoice amount snapshots are inconsistent.');
 if(inv.roundOffPaise!==undefined&&nearestRupeePaise(inv.subtotal-inv.discount+inv.tax)!==inv.total)throw new InvoicePdfReview('Invoice round-off snapshot is inconsistent.');
 if(inv.tax!==0||inv.taxRatePercent!==0||/gst/i.test(inv.taxDescription))throw new InvoicePdfReview('Unregistered issuer tax snapshot needs office review.');
}
export async function renderInvoicePdf(inv:PdfCheckSnapshot):Promise<Buffer>{
 assertInvoicePdfReady(inv);return renderSnapshot(inv);
}
/** Reuses the house invoice layout, but never fabricates a job invoice or a
 * blended tax/rounding policy for separately snapshotted obligations. */
export async function renderVisitInvoicePdf(raw:unknown):Promise<Buffer>{
 let saved;try{saved=parseVisitInvoiceRead(raw)}catch{throw new InvoicePdfReview('Issued visit invoice components need review.');}
 const original=raw as Record<string,any>,vehicle=original['vehicleSnapshot'];
 if(original['kind']!=='shared_visit_invoice'||original['status']!=='issued'||!vehicle||['make','model','registrationNumber'].some(k=>typeof vehicle[k]!=='string'||!vehicle[k].trim()))throw new InvoicePdfReview('Issued visit invoice identity needs review.');
 if(!saved.issuerSnapshot)throw new InvoicePdfReview('Invoice issuer snapshot needs review.');
 const common={invoiceNumber:saved.invoiceNumber,issuerSnapshot:saved.issuerSnapshot,customerSnapshot:saved.customerSnapshot,vehicleSnapshot:vehicle,status:'issued' as const,issuedAt:saved.issuedAt};
 for(const c of saved.components)assertInvoicePdfReady({...common,currency:'INR',lineItems:c.lineItems,subtotal:c.subtotalPaise,discount:c.discountPaise,tax:c.taxPaise,total:c.amountPaise,roundOffPaise:c.roundOffPaise,taxRatePercent:c.taxRatePercent,taxDescription:c.taxDescription});
 return renderSnapshot({...common,lineItems:saved.components.flatMap(c=>c.lineItems),subtotal:saved.subtotalPaise,discount:saved.discountPaise,tax:saved.taxPaise,total:saved.totalPaise,roundOffPaise:saved.roundOffPaise});
}
/** DORMANT preview renderer for a distinct retained-journey snapshot. No
 * production importer/trigger. Existing whole-service rounding stays unchanged.
 * Current registered issuer/nonzero-tax review gates remain unchanged too. */
export async function renderRetainedTransportInvoicePdf(raw:unknown):Promise<Buffer>{
 const saved=parseRetainedTransportInvoiceSnapshot(raw),problem=invoiceIssuerProblem(saved.issuerSnapshot);
 if(problem)throw new InvoicePdfReview(problem);
 if(saved.taxPaise!==0||saved.taxRatePercent!==0)throw new InvoicePdfReview('Retained journey tax snapshot needs office review.');
 const vehicle=saved.vehicleSnapshot;
 const snapshot={invoiceNumber:saved.invoiceNumber,issuerSnapshot:saved.issuerSnapshot,customerSnapshot:saved.customerSnapshot,
  vehicleSnapshot:{registrationNumber:vehicle['registrationNumber']!,make:vehicle['make']!,model:vehicle['model']!},status:'issued' as const,issuedAt:saved.issuedAt,
  lineItems:saved.components.map(c=>({description:c.description,quantity:c.quantity,unitPrice:c.unitPrice,total:c.total})),
  subtotal:saved.subtotalPaise,discount:0,tax:0,total:saved.totalPaise,roundOffPaise:0};
 // Exact original component policy has already been checked by the strict
 // parser. Do not apply full-service nearest-rupee validation to retained legs.
 return renderSnapshot(snapshot);
}
async function renderSnapshot(inv:PdfRenderSnapshot):Promise<Buffer>{return renderHouseInvoicePdf(inv);}
/** Caller must verify full original cancellation/funding/issue proof first.
 * This strict derivative never rewrites or rerounds the separate original. */
export async function renderCancellationChargeInvoicePdf(raw:Record<string,any>,feePaise:number,transportPaise:number):Promise<Buffer>{
 const{visitReturnHash}=await import('./visit-service-return-state.js');
 if(raw['kind']!=='visit_cancellation_charge_invoice'||raw['status']!=='issued'||raw['currency']!=='INR'||raw['snapshotHash']!==visitReturnHash({...raw,snapshotHash:undefined})||![feePaise,transportPaise,raw['totalPaise']].every(n=>Number.isSafeInteger(n)&&n>=0)||feePaise+transportPaise!==raw['totalPaise']||raw['totalPaise']<=0||raw['subtotalPaise']!==raw['totalPaise']||raw['taxPaise']!==0||raw['taxRatePercent']!==0||!raw['customerSnapshot']?.name?.trim()||!raw['vehicleSnapshot']?.registrationNumber?.trim()||typeof raw['invoiceNumber']!=='string'||!raw['invoiceNumber'].trim()||!Number.isFinite(Date.parse(raw['issuedAt'])))throw new InvoicePdfReview('Original cancellation charge snapshot needs review.');
 const problem=invoiceIssuerProblem(raw['issuerSnapshot']);if(problem)throw new InvoicePdfReview(problem);
 return renderSnapshot({invoiceNumber:raw['invoiceNumber'],issuerSnapshot:raw['issuerSnapshot'],customerSnapshot:raw['customerSnapshot'],vehicleSnapshot:{make:'',model:'',registrationNumber:raw['vehicleSnapshot'].registrationNumber},status:'issued',issuedAt:raw['issuedAt'],lineItems:[...(transportPaise?[{description:'Retained original journey',quantity:1,unitPrice:transportPaise,total:transportPaise}]:[]),...(feePaise?[{description:'Cancellation fee - existing booking policy',quantity:1,unitPrice:feePaise,total:feePaise}]:[])],subtotal:raw['subtotalPaise'],discount:0,tax:0,total:raw['totalPaise'],roundOffPaise:0});
}
