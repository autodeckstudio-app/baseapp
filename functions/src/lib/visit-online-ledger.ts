import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { utcToLocalDate } from './schedule.js';
import type { validateVisitOnlineReceiptProof } from './visit-online-receipt.js';
import { readVisitOnlineProof } from './visit-online-proof.js';

const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
export const VISIT_ONLINE_LEDGER_CAP = 2000;
const fail = (): never => { throw new HttpsError('failed-precondition', 'Visit online receipt history needs review. No partial money total returned.'); };

/** Bounded verified online source for billing/accounting. Online amounts never enter the offline journal. Capture
 * evidence on its own is not settled revenue. A complete original receipt,
 * all applications and issued invoice must reconcile before any row is read. */
export async function readVisitOnlineLedger(db: Firestore, tenantId: string, studioId: string) {
  if (!id(tenantId) || !id(studioId)) return fail();
  return db.runTransaction(async tx => {
    const [receipts, applications, captures, unresolved, ingressReviews] = await Promise.all([
      tx.get(db.collection('visitOnlineReceipts').where('tenantId','==',tenantId).where('studioId','==',studioId).limit(VISIT_ONLINE_LEDGER_CAP + 1)),
      tx.get(db.collection('visitOnlineApplications').where('tenantId','==',tenantId).where('studioId','==',studioId).limit(VISIT_ONLINE_LEDGER_CAP + 1)),
      tx.get(db.collection('visitProviderCaptures').where('tenantId','==',tenantId).where('studioId','==',studioId).limit(VISIT_ONLINE_LEDGER_CAP+1)),
      tx.get(db.collection('visitProviderEvents').where('tenantId','==',tenantId).where('studioId','==',studioId).where('outcome','in',['held','identity_conflict_review','extra_capture_review']).limit(1)),
      tx.get(db.collection('visitProviderIngressReviews').where('tenantId','==',tenantId).where('studioId','==',studioId).where('status','==','review_required').limit(1)),
    ]);
    if (receipts.size > VISIT_ONLINE_LEDGER_CAP || applications.size > VISIT_ONLINE_LEDGER_CAP || captures.size > VISIT_ONLINE_LEDGER_CAP)
      throw new HttpsError('resource-exhausted', 'Visit online journal exceeds the report cap. No partial money total returned.');
    if(!ingressReviews.empty||!unresolved.empty||new Set(receipts.docs.map(doc=>doc.data()['captureId'])).size!==receipts.size||captures.size!==receipts.size||captures.docs.some(doc=>!receipts.docs.some(receipt=>receipt.data()['captureId']===doc.id)))return fail();
    const receiptIds = new Set(receipts.docs.map(doc => doc.id));
    if (applications.docs.some(doc => !receiptIds.has(doc.data()['receiptId']))) return fail();
    const rows: ReturnType<typeof validateVisitOnlineReceiptProof>[] = [];
    for (const original of receipts.docs) {
      const r = original.data();
      if (r['id'] !== original.id || r['tenantId'] !== tenantId || r['studioId'] !== studioId ||
        ![r['attemptId'],r['captureId'],r['billId'],r['invoiceId']].every(id)) return fail();
      const proof = await readVisitOnlineProof(tx,db,original.id).catch(()=>fail());
      if (proof.applications.length !== applications.docs.filter(doc=>doc.data()['receiptId']===original.id).length) return fail();
      rows.push(proof.row);
    }
    return rows;
  });
}

/** Counts server recognition day in the studio timezone, never a fabricated
 * provider transaction timestamp, no private provider identities or job ids. */
export function visitOnlineLedgerTotals(rows: Awaited<ReturnType<typeof readVisitOnlineLedger>>, dateOrMonth: string) {
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(dateOrMonth) || new Set(rows.map(row=>row.id)).size !== rows.length) return fail();
  let receivedPaise = 0, paymentCount = 0;
  const receivedByDay: Record<string,number> = {};
  for (const row of rows) {
    if (!row || !id(row.id) || row.method !== 'razorpay_payment_link' || row.currency !== 'INR' || !Number.isSafeInteger(row.receivedPaise) || row.receivedPaise <= 0 || !Number.isFinite(Date.parse(row.recognisedAt))) return fail();
    const day = utcToLocalDate(new Date(row.recognisedAt),'Asia/Kolkata');
    if (!day.startsWith(dateOrMonth)) continue;
    receivedPaise += row.receivedPaise; paymentCount++;
    receivedByDay[day] = (receivedByDay[day] ?? 0) + row.receivedPaise;
    if (!Number.isSafeInteger(receivedPaise)) return fail();
  }
  return { receivedPaise, paymentCount, receivedByDay };
}
