import type {Firestore,Transaction} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {visitReturnHash} from './visit-service-return-state.js';
const fail=():never=>{throw new HttpsError('failed-precondition','Service return approval or actual-return evidence needs review.');};
export type VisitReturnEntry={key:string;paymentId:string|null;method:string;capturedPaise:number;retainedPaise:number;returnPaise:number;providerPaymentId:string|null;originalReceiptId:string|null};
/** Durable private approval/actual-manual-return evidence. Original captured
 * money/invoices are not rewritten into a false net receipt. Online requests
 * remain unsubmitted; approval alone never reports an actual return. */
export async function readVisitReturnProgress(tx:Transaction,db:Firestore,record:Record<string,any>,review:{entries:VisitReturnEntry[];returnPaise:number}){
 const approvalRef=db.collection('visitServiceReturnApprovals').doc(record['id']),approvalDoc=await tx.get(approvalRef),approval=approvalDoc.data();
 const returns=await tx.get(db.collection('visitServiceManualReturns').where('returnId','==',record['id']).limit(122));
 if(returns.size>121)return fail();
 const scope=['tenantId','studioId','customerId','vehicleId','visitId','jobId','bookingId']as const;
 if(approval&&(approval['id']!==record['id']||approval['kind']!=='visit_original_method_approval'||
   scope.some(k=>approval[k]!==record[k])||approval['reviewHash']!==record['reviewHash']||approval['planId']!==record['planId']||
   approval['returnPaise']!==review.returnPaise||typeof approval['approvedBy']!=='string'||!approval['approvedBy']||
   !Number.isFinite(Date.parse(approval['approvedAt']))||typeof approval['note']!=='string'||approval['note'].trim().length<3||
   approval['approvalHash']!==visitReturnHash({...approval,approvalHash:undefined})))return fail();
 if(!approval&&!returns.empty)return fail();
 const seen=new Set<string>();let returnedPaise=0;
 for(const d of returns.docs){const r=d.data(),entry=review.entries.find(e=>e.key===r['entryKey']);
  if(!entry||seen.has(entry.key)||entry.method==='razorpay_payment_link'||entry.returnPaise<=0||
    d.id!=='vmr_'+visitReturnHash([record['id'],entry.key])||r['id']!==d.id||r['kind']!=='visit_actual_manual_return'||
    r['returnId']!==record['id']||scope.some(k=>r[k]!==record[k])||r['reviewHash']!==record['reviewHash']||
    r['approvalHash']!==approval!['approvalHash']||r['amountPaise']!==entry.returnPaise||r['method']!==entry.method||
    r['paymentId']!==entry.paymentId||r['originalReceiptId']!==entry.originalReceiptId||
    !Number.isFinite(Date.parse(r['returnedAt']))||typeof r['returnedBy']!=='string'||!r['returnedBy']||
    typeof r['note']!=='string'||r['note'].trim().length<3||r['recordHash']!==visitReturnHash({...r,recordHash:undefined}))return fail();
  seen.add(entry.key);returnedPaise+=r['amountPaise'];
 }
 const manualDuePaise=review.entries.filter(e=>e.method!=='razorpay_payment_link'&&!seen.has(e.key)).reduce((n,e)=>n+e.returnPaise,0);
 const onlineDuePaise=review.entries.filter(e=>e.method==='razorpay_payment_link').reduce((n,e)=>n+e.returnPaise,0);
 if(![returnedPaise,manualDuePaise,onlineDuePaise].every(n=>Number.isSafeInteger(n)&&n>=0)||returnedPaise+manualDuePaise+onlineDuePaise!==review.returnPaise)return fail();
 const status=!approval?'awaiting_admin' as const:returnedPaise===review.returnPaise?'returned' as const:returnedPaise>0?'partly_returned' as const:'approved' as const;
 const refundStatus=review.returnPaise===0?'none':!approval?'awaiting_approval':returnedPaise===review.returnPaise?'processed':returnedPaise>0?'partially_returned':'approved';
 return{approval,returns:returns.docs.map(d=>d.data()),status,refundStatus,returnedPaise,manualDuePaise,onlineDuePaise,
  progressToken:visitReturnHash({record,approval:approval??null,returns:returns.docs.map(d=>d.data())}),
  entries:review.entries.map(e=>({...e,returnedPaise:seen.has(e.key)?e.returnPaise:0})),
  accountingReviewNeeded:review.entries.some(e=>seen.has(e.key)&&e.returnPaise>0)};
}
