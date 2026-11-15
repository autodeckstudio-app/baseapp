import {HttpsError} from 'firebase-functions/v2/https';
export type ReturnEntry={key:string;paymentId:string|null;method:string;capturedPaise:number;retainedPaise:number;returnPaise:number;returnedPaise:number;requestId:string|null};
export type CombinedReturn={version:2;kind:'cancellation'|'no_show';jobId:string;paidPaise:number;feePaise:number;refundPaise:number;entries:ReturnEntry[];status:'awaiting_admin'|'approved'|'returned';reason:string;createdAt:string;approvedBy:string|null;approvedAt:string|null};
function fail(message:string):never{throw new HttpsError('failed-precondition',message);}
function amount(n:unknown):n is number{return typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;}
/** Approved fee uses the advance first; every remainder stays on its original funding method. No money moves. */
export function allocateCombinedReturn(funding:{key:string;paymentId:string|null;method:string;capturedPaise:number;advance:boolean}[],feePaise:number):ReturnEntry[]{
 if(!amount(feePaise)||funding.some(f=>!amount(f.capturedPaise)||f.capturedPaise===0)||new Set(funding.map(f=>f.key)).size!==funding.length)fail('Funding amounts need review.');
 let remaining=Math.min(feePaise,funding.reduce((n,f)=>n+f.capturedPaise,0));
 return [...funding].sort((a,b)=>Number(b.advance)-Number(a.advance)||a.key.localeCompare(b.key)).map(f=>{const retainedPaise=Math.min(remaining,f.capturedPaise);remaining-=retainedPaise;return{key:f.key,paymentId:f.paymentId,method:f.method,capturedPaise:f.capturedPaise,retainedPaise,returnPaise:f.capturedPaise-retainedPaise,returnedPaise:0,requestId:null};});
}
export function combinedReturnTotals(plan:CombinedReturn){
 if(plan.version!==2||!Array.isArray(plan.entries)||new Set(plan.entries.map(e=>e.key)).size!==plan.entries.length)fail('Return allocation needs review.');
 let paid=0,fee=0,due=0,returned=0,cashDue=0;
 for(const e of plan.entries){if(![e.capturedPaise,e.retainedPaise,e.returnPaise,e.returnedPaise].every(amount)||e.retainedPaise+e.returnPaise!==e.capturedPaise||e.returnedPaise>e.returnPaise)fail('Return amounts need review.');paid+=e.capturedPaise;fee+=e.retainedPaise;due+=e.returnPaise-e.returnedPaise;returned+=e.returnedPaise;if(e.method!=='razorpay_payment_link')cashDue+=e.returnPaise-e.returnedPaise;}
 if(![paid,fee,due,returned,cashDue].every(amount)||paid!==plan.paidPaise||fee!==plan.feePaise||paid-fee!==plan.refundPaise)fail('Return totals need review.');
 return{due,returned,cashDue,paymentStatus:paid===0?'unpaid' as const:returned===paid?'refunded' as const:'partial' as const,refundStatus:plan.refundPaise===0?'none':due===0?'processed':'requested'};
}
