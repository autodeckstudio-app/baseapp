// DARK: no callable/index export, UI switch, trigger, deployment or activation.
// Only a later explicitly approved integration may call these internal functions.
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import type { AuthorizedUser } from '@autodeck/auth';
import type { Payment, ServiceJob } from '@autodeck/core';
import { COLLECTIONS } from '@autodeck/database';
import { assertRole, assertStudio } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/audit.js';
import { recordOfflineReceiptInTx } from '../functions/payment/recordOfflineReceipt.js';
import { closeCashLink } from './cash-link-evidence.js';
import type { PaymentProvider } from './payment-provider.js';

const input = z.object({
  jobId: z.string().min(1).max(128).regex(/^[^/]+$/),
  paymentId: z.string().min(1).max(128).regex(/^[^/]+$/),
  receiptKey: z.string().regex(/^[a-zA-Z0-9_-]{16,80}$/),
  receivedPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  receivedAt: z.string().datetime({ offset: true }),
  collectedBy: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(1).max(200),
}).strict();
type CashFact = z.infer<typeof input>;
type Intent = CashFact & { id: string; tenantId: string; studioId: string; customerId: string;
  providerLinkId: string; expectedAmount: number; currency: string; recordedBy: string;
  state: 'held' | 'review' | 'settled'; createdAt: string };
type HeldJob = ServiceJob & { cashReconciliationId?: string };
function scope(user: AuthorizedUser, j: HeldJob) {
  assertRole(user, 'admin', 'superadmin');
  if (j.tenantId !== user.claims.tenantId) throw new HttpsError('permission-denied', 'Cross-tenant cash reconciliation denied.');
  assertStudio(user, j.studioId, 'Job');
}
function bound(j: HeldJob, p: Payment, f: CashFact) {
  if (j.id !== f.jobId || p.id !== f.paymentId || p.jobId !== j.id || p.targetType !== 'job' ||
      p.tenantId !== j.tenantId || p.studioId !== j.studioId || p.customerId !== j.customerId ||
      p.amount !== j.totalAmount || p.method !== 'razorpay_payment_link' || p.currency !== 'INR' || !p.razorpayPaymentLinkId ||
      !Number.isSafeInteger(j.totalAmount) || j.totalAmount <= 0 || j.combinedPayment ||
      j.offlineSettlement || j.paymentStatus === 'paid' || j.paymentStatus === 'refunded' ||
      j.settlementKind === 'membership_covered' ||
      !['pending','processing','cancelled','failed'].includes(p.status))
    throw new HttpsError('failed-precondition', 'Payment or job needs office review. Do not collect again.');
}

/** Records the actual cash fact separately from allocation. Never sets paid,
 * issues an invoice, changes work/QC/handover or infers receipt amount from bill. */
export async function holdCashReconciliation(db: Firestore, user: AuthorizedUser, raw: unknown) {
  assertRole(user, 'admin', 'superadmin');
  const f = input.parse(raw);
  if (Date.parse(f.receivedAt) > Date.now() + 300000) throw new HttpsError('invalid-argument', 'Receipt time is in the future.');
  const ref = db.collection('cashReconciliations').doc(f.receiptKey);
  return db.runTransaction(async tx => {
    const [js, ps, old] = await Promise.all([
      tx.get(db.collection(COLLECTIONS.jobs()).doc(f.jobId)),
      tx.get(db.collection(COLLECTIONS.payments()).doc(f.paymentId)), tx.get(ref),
    ]);
    if (!js.exists || !ps.exists) throw new HttpsError('not-found', 'Job or payment missing.');
    const j = js.data() as HeldJob, p = ps.data() as Payment;
    scope(user,j);
    if (old.exists) {
      const prior = old.data() as Intent;
      if (prior.tenantId !== j.tenantId || Object.keys(f).some(k => prior[k as keyof CashFact] !== f[k as keyof CashFact]))
        throw new HttpsError('already-exists', 'Receipt key belongs to another cash fact.');
      return { id: prior.id, state: prior.state, alreadyRecorded: true };
    }
    bound(j,p,f);
    if(!['pending','processing'].includes(p.status))throw new HttpsError('failed-precondition','Select the pending online attempt for this cash fact.');
    if (j.cashReconciliationId) throw new HttpsError('failed-precondition', 'A cash fact already exists for this job. Reconcile it first.');
    const now = new Date().toISOString();
    const intent: Intent = { ...f, id:ref.id, tenantId:j.tenantId, studioId:j.studioId, customerId:j.customerId,
      providerLinkId:p.razorpayPaymentLinkId!, expectedAmount:p.amount, currency:p.currency,
      recordedBy:user.uid, state:'held', createdAt:now };
    tx.create(ref,intent);
    tx.update(js.ref,{cashReconciliationId:ref.id,updatedAt:now});
    writeAuditLog(tx,{action:'payment.cash_received_held',entityType:'Payment',entityId:p.id,user,studioId:j.studioId,
      before:{onlineStatus:p.status},
      after:{reconciliationId:ref.id,receivedPaise:f.receivedPaise,receivedAt:f.receivedAt,collectedBy:f.collectedBy,state:'held'}});
    return {id:ref.id,state:'held',alreadyRecorded:false};
  });
}

/** Retries recover the persisted fact; provider side effects are outside DB
 * transactions. A concurrent capture wins the transaction read and holds cash.
 * A later capture is recorded by the existing webhook in office review only. */
export async function runCashReconciliation(db: Firestore, user: AuthorizedUser, id: string, provider: PaymentProvider) {
  assertRole(user,'admin','superadmin');
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(id)) throw new HttpsError('invalid-argument','Invalid reconciliation key.');
  const ref = db.collection('cashReconciliations').doc(id);
  const intent = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new HttpsError('not-found','Cash fact missing.');
    const i = snapshot.data() as Intent;
    const [js,ps] = await Promise.all([tx.get(db.collection(COLLECTIONS.jobs()).doc(i.jobId)),tx.get(db.collection(COLLECTIONS.payments()).doc(i.paymentId))]);
    if (!js.exists || !ps.exists) throw new HttpsError('failed-precondition','Cash fact target missing.');
    const j = js.data() as HeldJob;
    scope(user,j);
    if (i.tenantId !== j.tenantId || i.customerId !== j.customerId || i.studioId !== j.studioId || j.cashReconciliationId !== id)
      throw new HttpsError('failed-precondition','Cash fact scope changed.');
    if (i.state !== 'settled') {
      const p=ps.data() as Payment;
      bound(j,p,i);
      if(p.razorpayPaymentLinkId!==i.providerLinkId||p.amount!==i.expectedAmount||p.currency!==i.currency)throw new HttpsError('failed-precondition','Cash provider binding changed.');
    }
    return i;
  });
  if (intent.state === 'settled') return {state:'settled',alreadyRecorded:true};
  let evidence;
  try {
    evidence = await closeCashLink(provider,{linkId:intent.providerLinkId,paymentId:intent.paymentId,amount:intent.expectedAmount,currency:intent.currency});
  } catch {
    evidence = {outcome:'review' as const,before:null,after:null};
  }
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const current = snapshot.data() as Intent;
    if (current.state === 'settled') return {state:'settled',alreadyRecorded:true};
    const now = new Date().toISOString();
    const attemptRef = db.collection('cashReconciliationAttempts').doc();
    // Do not persist customer/provider payloads. Only minimal bound evidence.
    const attempt = {id:attemptRef.id,reconciliationId:id,tenantId:intent.tenantId,createdAt:now,
      outcome:evidence.outcome,linkId:intent.providerLinkId,
      beforeStatus:evidence.before?.status??null,afterStatus:evidence.after?.status??null,
      afterAmountPaid:typeof evidence.after?.evidence?.amountPaid==='number'?evidence.after.evidence.amountPaid:null,actor:user.uid};
    if (evidence.outcome !== 'ready') {
      tx.create(attemptRef,attempt);tx.update(ref,{state:'review',updatedAt:now});
      return {state:'review',alreadyRecorded:false};
    }
    // Reuse all original receipt, consultation, approval, invoice and allocation
    // guards inside the SAME transaction as closing the local online attempt.
    const result = await recordOfflineReceiptInTx(db,tx,user,{jobId:intent.jobId,receiptKey:id,
      receivedPaise:intent.receivedPaise,method:'cash',reference:'Cash reconciliation '+id},
      {id,paymentId:intent.paymentId});
    tx.create(attemptRef,attempt);tx.update(ref,{state:'settled',settledAt:now,updatedAt:now});
    writeAuditLog(tx,{action:'payment.cash_reconciled',entityType:'Payment',entityId:intent.paymentId,user,studioId:intent.studioId,
      after:{reconciliationId:id,...result}});
    return {state:'settled',...result};
  });
}
