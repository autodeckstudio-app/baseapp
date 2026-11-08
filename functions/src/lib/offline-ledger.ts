import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { utcToLocalDate } from './schedule.js';
export const OFFLINE_LEDGER_CAP = 2000;
type Method = 'cash' | 'upi_manual' | 'bank_transfer';
export type OfflineReceiptRow = { id: string; jobId: string; createdAt: string; method: Method; receivedPaise: number; appliedPaise: number; officeReturnDuePaise: number; balanceDuePaise: number };
export type OfflineReturnRow = { id: string; jobId: string; createdAt: string; method: Method; amountPaise: number };
const methods = ['cash','upi_manual','bank_transfer'];
const whole = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
/** Bounded actual-money journal, not the final payment settlement projection.
 * Never returns silently partial totals, cross-studio rows or private free text. */
export async function readOfflineLedger(db: Firestore, tenantId: string, studioId: string) {
 const [receipts, returns] = await Promise.all(['offlineReceipts','offlineReturnRecords'].map(name => db.collection(name).where('tenantId','==',tenantId).where('studioId','==',studioId).limit(OFFLINE_LEDGER_CAP+1).get()));
 if (!receipts || !returns || receipts.size > OFFLINE_LEDGER_CAP || returns.size > OFFLINE_LEDGER_CAP)
  throw new HttpsError('resource-exhausted','Offline receipt history exceeds the report cap. No partial money total returned.');
 const receiptRows: OfflineReceiptRow[] = receipts.docs.map(d => {
  const r = d.data();
  if (r['tenantId']!==tenantId || r['studioId']!==studioId || typeof r['jobId']!=='string' || !methods.includes(r['method']) || !Number.isFinite(Date.parse(r['createdAt'])) || !whole(r['receivedPaise']) || r['receivedPaise']===0 || !whole(r['appliedPaise']) || !whole(r['officeReturnDuePaise']) || !whole(r['balanceDuePaise']) || r['receivedPaise']-r['appliedPaise']!==r['officeReturnDuePaise'])
   throw new HttpsError('failed-precondition','Offline receipt values need office review. No partial money total returned.');
  return {id:d.id,jobId:r['jobId'],createdAt:r['createdAt'],method:r['method'],receivedPaise:r['receivedPaise'],appliedPaise:r['appliedPaise'],officeReturnDuePaise:r['officeReturnDuePaise'],balanceDuePaise:r['balanceDuePaise']};
 });
 const returnRows: OfflineReturnRow[] = returns.docs.map(d => {
  const r=d.data();
  if (r['tenantId']!==tenantId || r['studioId']!==studioId || typeof r['jobId']!=='string' || !methods.includes(r['method']) || !Number.isFinite(Date.parse(r['createdAt'])) || !whole(r['amountPaise']) || r['amountPaise']===0)
   throw new HttpsError('failed-precondition','Offline return values need office review. No partial money total returned.');
  return {id:d.id,jobId:r['jobId'],createdAt:r['createdAt'],method:r['method'],amountPaise:r['amountPaise']};
 });
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
 return {receivedPaise,appliedPaise,cashPaise,upiPaise,bankTransferPaise,returnedPaise,cashReturnedPaise,paymentCount:receipts.length,revenueByDay,receipts,returns};
}
