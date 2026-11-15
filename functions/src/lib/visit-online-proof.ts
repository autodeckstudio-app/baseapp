import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { validateVisitOnlineReceiptProof } from './visit-online-receipt.js';
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(v);
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail = (): never => { throw new HttpsError('failed-precondition','Original visit online receipt needs review.'); };
/** Read a complete immutable proof inside the caller's transaction. */
export async function readVisitOnlineProof(tx: Transaction, db: Firestore, receiptId: string) {
  if (!id(receiptId)) return fail();
  const receiptDoc = await tx.get(db.collection('visitOnlineReceipts').doc(receiptId)), r = receiptDoc.data();
  if (!r || r['id'] !== receiptDoc.id || ![r['attemptId'],r['captureId'],r['billId'],r['invoiceId']].every(id)) return fail();
  const [attemptDoc,captureDoc,billDoc,invoiceDoc,siblings] = await Promise.all([
    tx.get(db.collection('visitProviderAttempts').doc(r['attemptId'])),tx.get(db.collection('visitProviderCaptures').doc(r['captureId'])),
    tx.get(db.collection('visitBills').doc(r['billId'])),tx.get(db.collection('visitInvoices').doc(r['invoiceId'])),
    tx.get(db.collection('visitOnlineApplications').where('receiptId','==',receiptId).limit(21)),
  ]);
  const stored = attemptDoc.data(),capture = captureDoc.data();
  if (!stored || !capture || !id(capture['firstEventId']) || stored['id'] !== attemptDoc.id || capture['id'] !== captureDoc.id ||
    ['tenantId','studioId','visitId'].some(k=>stored[k]!==r[k]) || siblings.docs.some(doc=>doc.data()['id']!==doc.id)) return fail();
  const eventDoc = await tx.get(db.collection('visitProviderEvents').doc('ve_'+hash(capture['firstEventId'])));
  const proof = { receipt:r,applications:siblings.docs.map(doc=>doc.data()),attempt:stored['attempt'],capture,event:eventDoc.data(),bill:billDoc.data(),invoice:invoiceDoc.data() };
  try { return { ...proof, row:validateVisitOnlineReceiptProof(proof) }; } catch { return fail(); }
}
