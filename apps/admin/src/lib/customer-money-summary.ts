import type {Invoice,Payment,ServiceJob} from '@autodeck/core';
type Scope={id:string;tenantId:string};
const amount=(v:number)=>Number.isSafeInteger(v)&&v>=0;
/** Read-only service balances, not a general account ledger. An issued invoice
 * is an immutable bill snapshot, never by itself evidence of debt or payment. */
export function customerServiceBalance(customer:Scope,jobs:ServiceJob[],payments:Payment[],invoices:Invoice[]){
 let duePaise=0;const review=new Set<string>();
 const scoped=(v:{tenantId:string;customerId:string})=>v.tenantId===customer.tenantId&&v.customerId===customer.id;
 for(const j of jobs){
  if(!scoped(j)){review.add('job:'+j.id);continue;}
  if(j.status==='CANCELLED')continue; // Cancellation/return obligations have their own ledger.
  const ps=payments.filter(p=>p.jobId===j.id&&scoped(p)&&p.studioId===j.studioId);
  if(!amount(j.totalAmount)||j.cashReconciliationId&&j.paymentStatus!=='paid'||ps.some(p=>(p as Payment&{invoiceReviewNeeded?:boolean}).invoiceReviewNeeded)) {review.add('job:'+j.id);continue;}
  const live=invoices.filter(i=>i.jobId===j.id&&i.status!=='void');
  if(live.length>1||live.some(i=>!scoped(i)||i.studioId!==j.studioId||i.total!==j.totalAmount)){review.add('job:'+j.id);continue;}
  if(j.paymentStatus==='paid'){
   const inv=live[0];
   if(j.totalAmount===0&&j.settlementKind==='membership_covered'){
    if(!inv||inv.id!==j.invoiceId||inv.status!=='issued'||inv.settlementKind!=='membership_covered'||!inv.membershipId||inv.paymentId!==null||ps.some(p=>!['cancelled','failed'].includes(p.status)))review.add('job:'+j.id);
    continue;
   }
   if(!inv||inv.status==='draft'){review.add('job:'+j.id);continue;}
   const paid=payments.find(p=>p.id===inv.paymentId&&scoped(p)&&p.studioId===j.studioId&&p.jobId===j.id&&p.invoiceId===inv.id&&p.status==='completed'&&p.currency===inv.currency&&amount(p.amount));
   const allocation=inv.paymentAllocation;
   const expectedIds=new Set([inv.paymentId,allocation?.advancePaymentId]);
   if(ps.some(p=>!['cancelled','failed'].includes(p.status)&&!expectedIds.has(p.id))||j.invoiceId&&j.invoiceId!==inv.id||inv.vehicleId&&inv.vehicleId!==j.vehicleId)review.add('job:'+j.id);
   if(allocation){
    const advance=payments.find(p=>p.id===allocation.advancePaymentId&&scoped(p)&&p.studioId===j.studioId&&p.bookingId===j.bookingId&&p.invoiceId===inv.id&&p.status==='completed'&&p.currency===inv.currency&&p.amount===allocation.advancePaidPaise);
    if(!paid||!advance||paid.id!==allocation.settlementPaymentId||paid.amount!==allocation.settlementPaidPaise||!amount(allocation.advancePaidPaise)||!amount(allocation.settlementPaidPaise)||allocation.advancePaidPaise+allocation.settlementPaidPaise!==j.totalAmount)review.add('job:'+j.id);
   }else if(!paid||paid.amount!==j.totalAmount)review.add('job:'+j.id);
   continue;
  }
  if(j.paymentStatus==='refunded'){review.add('job:'+j.id);continue;}
  if(ps.some(p=>['completed','partially_refunded','refunded'].includes(p.status))&&!j.combinedSettlement&&!j.offlineSettlement){review.add('job:'+j.id);continue;}
  if(j.paymentStatus==='partial'){
   // Actual receipts and combined advances need their ledger, not an invoice sum.
   review.add('job:'+j.id);continue;
  }
  if(j.paymentStatus!=='unpaid'||j.offlineSettlement||j.combinedSettlement||j.settlementKind==='membership_covered'||j.totalAmount===0&&live.length>0){review.add('job:'+j.id);continue;}
  duePaise+=j.totalAmount;
 }
 for(const i of invoices)if(i.status!=='void'&&!jobs.some(j=>j.id===i.jobId))review.add('invoice:'+i.id);
 if(!amount(duePaise))return{duePaise:0,needsReview:Math.max(1,review.size)};
 return {duePaise,needsReview:review.size};
}
/** Only a confirmed future booking with no terminal/arrived job is upcoming.
 * A cancelled mirrored job overrides an older CONFIRMED booking projection. */
export function nextCustomerBooking(bookings:{id:string;status:string;scheduledAt:string}[],jobs:Pick<ServiceJob,'bookingId'|'status'>[],now:string){
 return bookings.filter(b=>b.status==='CONFIRMED'&&Number.isFinite(Date.parse(b.scheduledAt))&&Date.parse(b.scheduledAt)>=Date.parse(now)&&!jobs.some(j=>j.bookingId===b.id&&j.status!=='PENDING_VEHICLE')).map(b=>b.scheduledAt).sort((a,b)=>Date.parse(a)-Date.parse(b))[0]??null;
}
