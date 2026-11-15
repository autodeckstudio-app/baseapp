import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { utcToLocalDate } from './schedule.js';
export const OFFLINE_LEDGER_CAP = 2000;
type Method = 'cash' | 'upi_manual' | 'bank_transfer';
export type OfflineReceiptRow = { actualReceiptId?: string; id: string; jobId: string; createdAt: string; method: Method; receivedPaise: number; appliedPaise: number; officeReturnDuePaise: number; balanceDuePaise: number };
export type OfflineReturnRow = { id: string; jobId: string; createdAt: string; method: Method; amountPaise: number };
const methods = ['cash','upi_manual','bank_transfer'];
const whole = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
/** Bounded actual-money journal, not the final payment settlement projection.
 * Never returns silently partial totals, cross-studio rows or private free text. */
export async function readOfflineLedger(db: Firestore, tenantId: string, studioId: string) {
 const [receipts, returns] = await Promise.all(['offlineReceipts','offlineReturnRecords'].map(name => db.collection(name).where('tenantId','==',tenantId).where('studioId','==',studioId).limit(OFFLINE_LEDGER_CAP+1).get()));
 if (!receipts || !returns || receipts.size > OFFLINE_LEDGER_CAP || returns.size > OFFLINE_LEDGER_CAP)
  throw new HttpsError('resource-exhausted','Offline receipt history exceeds the report cap. No partial money total returned.');
 // A visit receipt is one money event with several application rows. Verify
 // the complete original before using its event identity for receipt counts.
 const groups=new Map<string,typeof receipts.docs>();
 for(const d of receipts.docs){const r=d.data();if(r['visitReceiptId']!==undefined){
  if(typeof r['visitReceiptId']!=='string'||!/^vr_[a-f0-9]{64}$/.test(r['visitReceiptId']))throw new HttpsError('failed-precondition','Visit receipt journal needs office review.');
  const children=groups.get(r['visitReceiptId'])??[];children.push(d);groups.set(r['visitReceiptId'],children);
 }}
 if(groups.size){
  const originals=await db.getAll(...[...groups.keys()].map(id=>db.collection('visitReceipts').doc(id)));
  if(originals.length!==groups.size)throw new HttpsError('failed-precondition','Visit receipt original is missing.');
  for(const original of originals){const p=original.data(),children=groups.get(original.id);
   if(!p||!children||p['id']!==original.id||p['kind']!=='visit_actual_receipt'||p['tenantId']!==tenantId||p['studioId']!==studioId||p['currency']!=='INR'||typeof p['visitId']!=='string'||typeof p['billId']!=='string'||!methods.includes(p['method'])||!whole(p['receivedPaise'])||!p['receivedPaise']||!Array.isArray(p['applications'])||!p['applications'].length||p['applications'].length>20||p['applications'].length!==children.length||new Set(p['applications'].map((a:any)=>a?.applicationId)).size!==children.length||new Set(p['applications'].map((a:any)=>a?.jobId)).size!==children.length||p['applications'].some((a:any)=>!a||typeof a.applicationId!=='string'||typeof a.jobId!=='string'||!whole(a.appliedPaise)||!a.appliedPaise)||p['applications'].reduce((n:number,a:any)=>n+a.appliedPaise,0)!==p['receivedPaise'])throw new HttpsError('failed-precondition','Visit receipt original needs office review.');
   for(const d of children){const r=d.data(),a=p['applications'].find((a:any)=>a.applicationId===d.id);
    if(!a||a.jobId!==r['jobId']||a.appliedPaise!==r['receivedPaise']||a.appliedPaise!==r['appliedPaise']||r['officeReturnDuePaise']!==0||r['id']!==d.id||['tenantId','studioId','customerId','visitId','billId','method','reference','createdAt'].some(k=>r[k]!==p[k]))throw new HttpsError('failed-precondition','Visit receipt application needs office review.');
   }
  }
 }
 const receiptRows: OfflineReceiptRow[] = receipts.docs.map(d => {
  const r = d.data();
  if (r['tenantId']!==tenantId || r['studioId']!==studioId || typeof r['jobId']!=='string' || !methods.includes(r['method']) || !Number.isFinite(Date.parse(r['createdAt'])) || !whole(r['receivedPaise']) || r['receivedPaise']===0 || !whole(r['appliedPaise']) || !whole(r['officeReturnDuePaise']) || !whole(r['balanceDuePaise']) || r['receivedPaise']-r['appliedPaise']!==r['officeReturnDuePaise'])
   throw new HttpsError('failed-precondition','Offline receipt values need office review. No partial money total returned.');
  return {...(r['visitReceiptId']?{actualReceiptId:r['visitReceiptId']}:{ }),id:d.id,jobId:r['jobId'],createdAt:r['createdAt'],method:r['method'],receivedPaise:r['receivedPaise'],appliedPaise:r['appliedPaise'],officeReturnDuePaise:r['officeReturnDuePaise'],balanceDuePaise:r['balanceDuePaise']};
 });
 const returnRows: OfflineReturnRow[] = returns.docs.map(d => {
  const r=d.data();
  if (r['tenantId']!==tenantId || r['studioId']!==studioId || typeof r['jobId']!=='string' || !methods.includes(r['method']) || !Number.isFinite(Date.parse(r['createdAt'])) || !whole(r['amountPaise']) || r['amountPaise']===0)
   throw new HttpsError('failed-precondition','Offline return values need office review. No partial money total returned.');
  return {id:d.id,jobId:r['jobId'],createdAt:r['createdAt'],method:r['method'],amountPaise:r['amountPaise']};
 });
 // Cancellation charges are separate original actual-money events, not job
 // payment projections or a second copy of a visit receipt. Read every scoped
 // obligation as well as the rows so deleted money does not disappear silently.
 const[charges,chargeReceipts]=await Promise.all(['visitCancellationCharges','visitCancellationChargeReceipts'].map(name=>db.collection(name).where('tenantId','==',tenantId).where('studioId','==',studioId).limit(OFFLINE_LEDGER_CAP+1).get()));
 if(!charges||!chargeReceipts||charges.size>OFFLINE_LEDGER_CAP||chargeReceipts.size>OFFLINE_LEDGER_CAP)throw new HttpsError('resource-exhausted','Cancellation charge report cap exceeded.');
 if(charges.size||chargeReceipts.size){const{readVisitBilling}=await import('./visit-billing.js');const visits=new Set<string>();for(const c of charges.docs){const r=c.data();if(r['id']!==c.id||r['tenantId']!==tenantId||r['studioId']!==studioId||typeof r['visitId']!=='string')throw new HttpsError('failed-precondition','Cancellation charge report needs review.');visits.add(r['visitId']);}const verified=new Map<string,Record<string,any>>();for(const visitId of visits){const bill=await db.runTransaction(tx=>readVisitBilling(tx,db,visitId));for(const c of bill.chargeReviews){if(c.record['tenantId']!==tenantId||c.record['studioId']!==studioId||!charges.docs.some(d=>d.id===c.record['id']))throw new HttpsError('failed-precondition','Cancellation charge scope changed.');for(const row of c.receipts)verified.set(row.id,row);}}if(verified.size!==chargeReceipts.size||chargeReceipts.docs.some(d=>!verified.has(d.id)))throw new HttpsError('failed-precondition','Cancellation charge receipt set needs review.');for(const r of verified.values())receiptRows.push({actualReceiptId:r['id'],id:r['id'],jobId:r['jobId'],createdAt:r['createdAt'],method:r['method'],receivedPaise:r['receivedPaise'],appliedPaise:r['receivedPaise'],officeReturnDuePaise:0,balanceDuePaise:0});}
 return {receipts:receiptRows,returns:returnRows};
}
export function offlineLedgerTotals(ledger: {receipts: OfflineReceiptRow[]; returns: OfflineReturnRow[]}, dateOrMonth: string) {
 let receivedPaise=0,appliedPaise=0,cashPaise=0,upiPaise=0,bankTransferPaise=0,returnedPaise=0,cashReturnedPaise=0;
 const revenueByDay: Record<string,number>={};
 const receipts=ledger.receipts.filter(r=>utcToLocalDate(new Date(r.createdAt),'Asia/Kolkata').startsWith(dateOrMonth));
 const returns=ledger.returns.filter(r=>utcToLocalDate(new Date(r.createdAt),'Asia/Kolkata').startsWith(dateOrMonth));
 const sum=(a:number,b:number)=>{const n=a+b;if(!Number.isSafeInteger(n))throw new HttpsError('failed-precondition','Money report total exceeds safe minor units.');return n;};
 for(const r of receipts){receivedPaise=sum(receivedPaise,r.receivedPaise);appliedPaise=sum(appliedPaise,r.appliedPaise);const day=utcToLocalDate(new Date(r.createdAt),'Asia/Kolkata');revenueByDay[day]=sum(revenueByDay[day]??0,r.appliedPaise);if(r.method==='cash')cashPaise=sum(cashPaise,r.receivedPaise);else if(r.method==='upi_manual')upiPaise=sum(upiPaise,r.receivedPaise);else bankTransferPaise=sum(bankTransferPaise,r.receivedPaise);}
 for(const r of returns){returnedPaise=sum(returnedPaise,r.amountPaise);if(r.method==='cash')cashReturnedPaise=sum(cashReturnedPaise,r.amountPaise);}
 return {receivedPaise,appliedPaise,cashPaise,upiPaise,bankTransferPaise,returnedPaise,cashReturnedPaise,paymentCount:new Set(receipts.map(r=>r.actualReceiptId?'visit:'+r.actualReceiptId:'job:'+r.id)).size,revenueByDay,receipts,returns};
}
