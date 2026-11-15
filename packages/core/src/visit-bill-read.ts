import type{InvoiceIssuer}from'./invoice-issuer';
import type {VisitRead} from './visit-read';
export type VisitInvoiceRead={issuerSnapshot?:InvoiceIssuer;id:string;invoiceNumber:string;issuedAt:string;totalPaise:number;subtotalPaise:number;discountPaise:number;taxPaise:number;roundOffPaise:number;customerSnapshot:{name:string};vehicleSnapshot:{registrationNumber:string};components:{jobId:string;amountPaise:number;taxPaise:number;taxRatePercent:number;taxDescription:string;lineItems:{description:string;quantity:number;unitPrice:number;total:number}[]}[]};
export type VisitBillRead={visitId:string;revision:number;reviewToken:string;currency:'INR';totalPaise:number;appliedPaise:number;balancePaise:number;sharedInvoices:VisitInvoiceRead[];lines:{jobId:string;name:string;amountPaise:number;appliedPaise:number;cancelled:boolean;invoiceNumber:string|null;visitInvoiceId:string|null;taxPaise:number|null}[]};
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const money=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
/** A funding review must describe exactly the currently displayed physical
 * visit, not a prior car, partial member list or a guessed paid projection. */
export function parseVisitBillRead(raw:unknown,view:VisitRead):VisitBillRead{
 const fail=():never=>{throw Error('Visit bill changed. Refresh the visit.');};
 if(view.status!=='grouped'||!record(raw)||raw.visitId!==view.visitId||raw.revision!==view.revision||raw.currency!=='INR'||typeof raw.reviewToken!=='string'||!/^[a-f0-9]{64}$/.test(raw.reviewToken)||!money(raw.totalPaise)||!money(raw.appliedPaise)||!money(raw.balancePaise)||raw.appliedPaise+raw.balancePaise!==raw.totalPaise||raw.totalPaise!==view.bill.totalAmount||!Array.isArray(raw.lines)||raw.lines.length!==view.members.length||new Set(raw.lines.map((l:any)=>l?.jobId)).size!==view.members.length)return fail();
 const lines=raw.lines.map((l:unknown)=>{if(!record(l))return fail();const m=view.members.find(m=>m.jobId===l.jobId);if(!m||typeof l.name!=='string'||!l.name.trim()||!money(l.amountPaise)||!money(l.appliedPaise)||l.appliedPaise>l.amountPaise||l.amountPaise!==m.totalAmount||l.cancelled!==(m.status==='CANCELLED')||l.cancelled&&l.appliedPaise!==0||!(l.invoiceNumber===null||typeof l.invoiceNumber==='string'&&l.invoiceNumber.length>0)||!(l.taxPaise===null||money(l.taxPaise)&&l.taxPaise<=l.amountPaise)||l.appliedPaise===0&&m.paymentStatus!=='unpaid'&&!(l.amountPaise===0&&m.paymentStatus==='paid')||l.appliedPaise>0&&m.paymentStatus!==(l.appliedPaise===l.amountPaise?'paid':'partial'))return fail();return{jobId:m.jobId,name:l.name,amountPaise:l.amountPaise,appliedPaise:l.appliedPaise,cancelled:l.cancelled,invoiceNumber:l.invoiceNumber,visitInvoiceId:l.visitInvoiceId??null,taxPaise:l.taxPaise};});
 const active=lines.filter(l=>!l.cancelled);if(active.reduce((n,l)=>n+l.amountPaise,0)!==raw.totalPaise||active.reduce((n,l)=>n+l.appliedPaise,0)!==raw.appliedPaise)return fail();
 const sharedInvoices=raw.sharedInvoices??[];
 if(!Array.isArray(sharedInvoices)||sharedInvoices.length>20||new Set(sharedInvoices.map((i:any)=>i?.id)).size!==sharedInvoices.length)return fail();
 for(const i of sharedInvoices){
  if(!record(i)||typeof i.id!=='string'||typeof i.invoiceNumber!=='string'||!i.invoiceNumber||!Number.isFinite(Date.parse(i.issuedAt))||!['totalPaise','subtotalPaise','discountPaise','taxPaise'].every(k=>money(i[k]))||!Number.isSafeInteger(i.roundOffPaise)||i.subtotalPaise-i.discountPaise+i.taxPaise+i.roundOffPaise!==i.totalPaise||!record(i.customerSnapshot)||typeof i.customerSnapshot.name!=='string'||!record(i.vehicleSnapshot)||typeof i.vehicleSnapshot.registrationNumber!=='string'||i.issuerSnapshot!==undefined&&(!record(i.issuerSnapshot)||['tradeName','legalName','address','phone','email'].some(k=>typeof i.issuerSnapshot[k]!=='string'||!i.issuerSnapshot[k].trim())||typeof i.issuerSnapshot.gstRegistered!=='boolean'||!(i.issuerSnapshot.gstin===null||typeof i.issuerSnapshot.gstin==='string'))||!Array.isArray(i.components)||!i.components.length||i.components.length>20||new Set(i.components.map((c:any)=>c?.jobId)).size!==i.components.length)return fail();
  let sum=0;for(const c of i.components){if(!record(c))return fail();const line=lines.find(l=>l.jobId===c.jobId);if(!line||line.visitInvoiceId!==i.id||line.invoiceNumber!==i.invoiceNumber||line.amountPaise!==c.amountPaise||line.taxPaise!==c.taxPaise||!money(c.taxPaise)||!Number.isFinite(c.taxRatePercent)||c.taxRatePercent<0||typeof c.taxDescription!=='string'||!Array.isArray(c.lineItems)||!c.lineItems.length||c.lineItems.length>200||c.lineItems.some((l:any)=>!record(l)||typeof l.description!=='string'||!l.description||!Number.isSafeInteger(l.quantity)||l.quantity<=0||!money(l.unitPrice)||!money(l.total)||l.unitPrice*l.quantity!==l.total))return fail();sum+=c.amountPaise;}if(sum!==i.totalPaise)return fail();
 }
 if(lines.some(l=>l.visitInvoiceId&&!sharedInvoices.some((i:any)=>i.id===l.visitInvoiceId&&i.components.some((c:any)=>c.jobId===l.jobId))))return fail();
 return{visitId:raw.visitId,revision:raw.revision,reviewToken:raw.reviewToken,currency:'INR',totalPaise:raw.totalPaise,appliedPaise:raw.appliedPaise,balancePaise:raw.balancePaise,sharedInvoices,lines};
}
/** Only verified original-funding reads may label a grouped service paid. */
export function visitFundingLabel(view:VisitRead|null|undefined,bill:VisitBillRead|null,jobId:string,error=false):string|null{
 if(view?.status!=='grouped')return null;
 if(error)return'Bill needs review';
 if(!bill||bill.visitId!==view.visitId||bill.revision!==view.revision)return'Checking visit bill';
 const line=bill.lines.find(l=>l.jobId===jobId);if(!line)return'Bill needs review';
 if(line.cancelled)return'Cancelled · Review returns';
 return line.appliedPaise===line.amountPaise?'Paid · Visit bill':line.appliedPaise>0?'Part payment · Visit bill':'Unpaid';
}
