import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {readVisitBilling} from './visit-billing.js';
import {visitReturnHash} from './visit-service-return-state.js';
import {utcToLocalDate} from './schedule.js';
export const VISIT_RETURN_LEDGER_CAP=2000;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v);
const fail=():never=>{throw new HttpsError('failed-precondition','Service return history needs review. No partial money total returned.');};
const sum=(a:number,b:number)=>{const n=a+b;if(!Number.isSafeInteger(n)||n<0)return fail();return n;};
type Status='awaiting_admin'|'approved'|'partly_returned'|'returned';
export type VisitReturnObligation={id:string;status:Status;paidPaise:number;retainedPaise:number;returnPaise:number;returnedPaise:number;manualDuePaise:number;onlineDuePaise:number;accountingReviewNeeded:boolean};
export type VisitReturnEvent={id:string;method:'cash'|'upi_manual'|'bank_transfer'|'razorpay_payment_link';amountPaise:number;recognisedAt:string;accountingReviewNeeded:true};
export type VisitReturnLedger={obligations:VisitReturnObligation[];events:VisitReturnEvent[]};
/** Finite allowlist for Office/Accountant. Re-read original funding and every
 * cancellation/approval/actual-return fact in one transaction. Empty/missing
 * children never silently erase money: scoped marker and orphan scans reconcile
 * with the exact private reader before any row is projected. No source/job/car,
 * provider, actor, note, approval or operation identity crosses this boundary. */
export async function readVisitReturnLedger(db:Firestore,tenantId:string,studioId:string):Promise<VisitReturnLedger>{
 if(!id(tenantId)||!id(studioId))return fail();
 return db.runTransaction(async tx=>{
  const scope=(name:string)=>db.collection(name).where('tenantId','==',tenantId).where('studioId','==',studioId);
  const [roots,approvals,manual,online,bookings,jobs,identities]=await Promise.all([
   ...['visitServiceReturns','visitServiceReturnApprovals','visitServiceManualReturns','visitServiceOnlineReturns'].map(name=>tx.get(scope(name).limit(VISIT_RETURN_LEDGER_CAP+1))),
   tx.get(scope('bookings').where('status','==','CANCELLED').limit(VISIT_RETURN_LEDGER_CAP+1)),
   tx.get(scope('jobs').where('status','==','CANCELLED').limit(VISIT_RETURN_LEDGER_CAP+1)),
   // Provider identities predate a studio field. Resolve their exact request
   // rather than inferring a studio or ignoring a lost processed return.
   tx.get(db.collection('visitServiceProviderRefunds').where('tenantId','==',tenantId).limit(VISIT_RETURN_LEDGER_CAP+1)),
  ]);
  if(!roots||!approvals||!manual||!online||!bookings||!jobs||!identities)return fail();
  if([roots,approvals,manual,online,bookings,jobs,identities].some(s=>s.size>VISIT_RETURN_LEDGER_CAP))throw new HttpsError('resource-exhausted','Service return history exceeds the report cap. No partial money total returned.');
  const originals=new Map(roots.docs.map(d=>[d.id,d.data()]));
  for(const doc of roots.docs){const r=doc.data();if(r['id']!==doc.id||r['jobId']!==doc.id||!id(r['visitId'])||!id(r['bookingId']))return fail();}
  for(const doc of approvals.docs)if(!originals.has(doc.id))return fail();
  for(const doc of [...manual.docs,...online.docs])if(!originals.has(doc.data()['returnId']))return fail();
  for(const doc of [...bookings.docs,...jobs.docs]){const marker=doc.data()['visitServiceReturnId'];if(marker!==undefined&&(!id(marker)||!originals.has(marker)))return fail();}
  for(const doc of roots.docs){const r=doc.data();if(!jobs.docs.some(d=>d.id===r['jobId']&&d.data()['visitServiceReturnId']===doc.id)||!bookings.docs.some(d=>d.id===r['bookingId']&&d.data()['visitServiceReturnId']===doc.id))return fail();}
  const scopedIdentity=new Map<string,Record<string,any>>();
  for(const doc of identities.docs){const r=doc.data();if(!id(r['requestId']))return fail();const request=(await tx.get(db.collection('visitServiceOnlineReturns').doc(r['requestId']))).data();
   if(!request||request['tenantId']!==tenantId||request['state']!=='returned')return fail();
   if(request['studioId']!==studioId)continue;
   if(!online.docs.some(d=>d.id===r['requestId'])||!request['evidence']||doc.id!=='vpr_'+visitReturnHash(request['evidence'].id)||scopedIdentity.has(r['requestId'])||!Number.isFinite(Date.parse(r['recognisedAt']))||r['recognisedAt']!==request['updatedAt'])return fail();
   scopedIdentity.set(r['requestId'],r);
  }
  const visits=new Map<string,Awaited<ReturnType<typeof readVisitBilling>>>(),obligations:VisitReturnObligation[]=[],events:VisitReturnEvent[]=[];
  for(const doc of roots.docs){const r=doc.data();let bill=visits.get(r['visitId']);if(!bill){bill=await readVisitBilling(tx,db,r['visitId']);visits.set(r['visitId'],bill);}
   if(bill.visit.tenantId!==tenantId||bill.visit.studioId!==studioId)return fail();const p=bill.returnReviews.find(p=>p.jobId===doc.id);if(!p)return fail();
   const opaque='vrl_'+visitReturnHash([tenantId,studioId,doc.id]);
   obligations.push({id:opaque,status:p.status,paidPaise:p.paidPaise,retainedPaise:p.retainedPaise,returnPaise:p.returnPaise,returnedPaise:p.returnedPaise,manualDuePaise:p.manualDuePaise,onlineDuePaise:p.onlineDuePaise,accountingReviewNeeded:p.accountingReviewNeeded});
   let actual=0;
   for(const child of manual.docs.filter(d=>d.data()['returnId']===doc.id)){const m=child.data();if(m['accountingReviewNeeded']!==true||!['cash','upi_manual','bank_transfer'].includes(m['method']))return fail();actual=sum(actual,m['amountPaise']);events.push({id:child.id,method:m['method'],amountPaise:m['amountPaise'],recognisedAt:m['returnedAt'],accountingReviewNeeded:true});}
   for(const child of online.docs.filter(d=>d.data()['returnId']===doc.id&&d.data()['state']==='returned')){const m=child.data(),identity=scopedIdentity.get(child.id);if(!identity)return fail();actual=sum(actual,m['amountPaise']);events.push({id:child.id,method:'razorpay_payment_link',amountPaise:m['amountPaise'],recognisedAt:identity['recognisedAt'],accountingReviewNeeded:true});}
   if(actual!==p.returnedPaise)return fail();
  }
  // A different visit sharing scope cannot hide a cancelled funded member from
  // this root scan. The existing reader independently validates its markers.
  for(const bill of visits.values())if(bill.returnReviews.some(p=>!originals.has(p.jobId)))return fail();
  return{obligations:obligations.sort((a,b)=>a.id.localeCompare(b.id)),events:events.sort((a,b)=>a.recognisedAt.localeCompare(b.recognisedAt)||a.id.localeCompare(b.id))};
 });
}
/** Original receipts remain gross. Actual returns are separate flows on their
 * server-recorded local day; owed totals are current, not month-filtered. Manual
 * due is already in legacy refundsOwed and must never be added to it again. */
export function visitReturnLedgerTotals(ledger:VisitReturnLedger,dateOrMonth:string){
 if(!/^\d{4}-\d{2}(-\d{2})?$/.test(dateOrMonth)||new Set(ledger.events.map(e=>e.id)).size!==ledger.events.length||new Set(ledger.obligations.map(o=>o.id)).size!==ledger.obligations.length)return fail();
 let returnedPaise=0,cashReturnedPaise=0,upiReturnedPaise=0,bankReturnedPaise=0,onlineReturnedPaise=0,manualDuePaise=0,onlineDuePaise=0,manualDueCount=0,onlineDueCount=0;
 for(const o of ledger.obligations){
  if(!id(o.id)||!['awaiting_admin','approved','partly_returned','returned'].includes(o.status)||
   ![o.paidPaise,o.retainedPaise,o.returnPaise,o.returnedPaise,o.manualDuePaise,o.onlineDuePaise].every(n=>Number.isSafeInteger(n)&&n>=0)||
   o.paidPaise<=0||o.accountingReviewNeeded!==(o.returnedPaise>0)||
   o.retainedPaise+o.returnPaise!==o.paidPaise||o.returnedPaise+o.manualDuePaise+o.onlineDuePaise!==o.returnPaise||
   ['awaiting_admin','approved'].includes(o.status)&&o.returnedPaise!==0||o.status==='approved'&&o.returnPaise===0||
   o.status==='partly_returned'&&!(o.returnedPaise>0&&o.returnedPaise<o.returnPaise)||
   o.status==='returned'&&o.returnedPaise!==o.returnPaise)return fail();
  manualDuePaise=sum(manualDuePaise,o.manualDuePaise);onlineDuePaise=sum(onlineDuePaise,o.onlineDuePaise);
  if(o.manualDuePaise)manualDueCount++;if(o.onlineDuePaise)onlineDueCount++;
 }
 let lifetimeReturned=0;for(const event of ledger.events){if(!Number.isSafeInteger(event.amountPaise)||event.amountPaise<=0)return fail();lifetimeReturned=sum(lifetimeReturned,event.amountPaise);}
 if(lifetimeReturned!==ledger.obligations.reduce((n,o)=>sum(n,o.returnedPaise),0))return fail();
 const events=ledger.events.filter(e=>{if(!id(e.id)||!Number.isSafeInteger(e.amountPaise)||e.amountPaise<=0||!Number.isFinite(Date.parse(e.recognisedAt))||!['cash','upi_manual','bank_transfer','razorpay_payment_link'].includes(e.method)||e.accountingReviewNeeded!==true)return fail();return utcToLocalDate(new Date(e.recognisedAt),'Asia/Kolkata').startsWith(dateOrMonth);});
 for(const e of events){returnedPaise=sum(returnedPaise,e.amountPaise);if(e.method==='cash')cashReturnedPaise=sum(cashReturnedPaise,e.amountPaise);else if(e.method==='upi_manual')upiReturnedPaise=sum(upiReturnedPaise,e.amountPaise);else if(e.method==='bank_transfer')bankReturnedPaise=sum(bankReturnedPaise,e.amountPaise);else onlineReturnedPaise=sum(onlineReturnedPaise,e.amountPaise);}
 return{returnedPaise,cashReturnedPaise,upiReturnedPaise,bankReturnedPaise,onlineReturnedPaise,returnCount:events.length,manualDuePaise,onlineDuePaise,manualDueCount,onlineDueCount,accountingReviewNeeded:events.length>0,events};
}
