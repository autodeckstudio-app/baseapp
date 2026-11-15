import type{VisitRead}from'./visit-read';
/** Read-only itemized original service obligations. Not a receipt, new invoice,
 * consolidated balance or cancellation/refund calculation. */
export function visitChargeSummary(view:VisitRead|null|undefined){
 if(view?.status!=='grouped')return null;
 const rows=view.members.map(m=>({jobId:m.jobId,bookingId:m.bookingId,name:m.lines.map(l=>l.name).join(' + '),totalAmount:m.totalAmount,cancelled:m.status==='CANCELLED'}));
 return{rows,totalAmount:view.bill.totalAmount,hasCancelled:rows.some(r=>r.cancelled)};
}
