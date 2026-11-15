import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { parseVisitInvoiceRead } from '@autodeck/core';
import { assertVisitProviderAttempt, type VisitProviderAttempt } from './visit-provider-attempt.js';

/** Separate online journal contract. No offline receipt/application is written
 * or reclassified. This validator is dormant until a settlement transaction
 * supplies all originals and reports consume the same verified source. */
export type VisitOnlineReceipt = {
  id: string; kind: 'visit_online_receipt'; tenantId: string; studioId: string; customerId: string;
  visitId: string; billId: string; attemptId: string; captureId: string; providerPaymentId: string;
  method: 'razorpay_payment_link'; currency: 'INR'; receivedPaise: number;
  /** Server recognition time of verified evidence, not provider capture time. */
  recognisedAt: string; invoiceId: string;
  applications: { id: string; jobId: string; appliedPaise: number }[];
};
export type VisitOnlineApplication = {
  id: string; receiptId: string; tenantId: string; studioId: string; customerId: string;
  visitId: string; billId: string; attemptId: string; jobId: string; appliedPaise: number;
  method: 'razorpay_payment_link'; currency: 'INR'; recognisedAt: string;
};
const id = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(s);
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail = (): never => { throw new Error('Original visit online receipt needs review.'); };
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const time = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

/** Build identities only. The transaction must read their absence first, then
 * atomically write these facts with one issued invoice and job projections.
 * No function here changes state or makes money settled on its own. */
export function planVisitOnlineReceipt(attempt: VisitProviderAttempt, capture: unknown) {
  assertVisitProviderAttempt(attempt);
  if (attempt.state !== 'captured_review' || !attempt.capture || !record(capture) ||
    capture['id'] !== 'vc_' + hash(attempt.capture.providerPaymentId) || capture['providerPaymentId'] !== attempt.capture.providerPaymentId ||
    capture['attemptId'] !== attempt.id || ['tenantId','studioId','visitId'].some(k => capture[k] !== (attempt as any)[k]) ||
    capture['amountPaise'] !== attempt.amountPaise || capture['currency'] !== 'INR' || capture['providerLinkId'] !== attempt.link?.providerLinkId ||
    capture['providerOrderId'] !== attempt.link?.providerOrderId || capture['firstEventId'] !== attempt.capture.firstEventId ||
    capture['status'] !== 'review_required' || !time(capture['createdAt'])) return fail();
  // Keep the historical vi_vr_* identity shape without sharing the offline
  // operation namespace. The immutable online receipt lives in its own journal.
  const receiptId = 'vr_' + hash(['online', capture['id']]);
  const receipt: VisitOnlineReceipt = {
    id: receiptId, kind: 'visit_online_receipt', tenantId: attempt.tenantId, studioId: attempt.studioId, customerId: attempt.customerId,
    visitId: attempt.visitId, billId: attempt.billId, attemptId: attempt.id, captureId: capture['id'], providerPaymentId: attempt.capture.providerPaymentId,
    method: 'razorpay_payment_link', currency: 'INR', receivedPaise: attempt.amountPaise, recognisedAt: capture['createdAt'], invoiceId: 'vi_' + receiptId,
    applications: attempt.allocation.entries.filter(e => e.appliedPaise > 0).map(e => ({ id: receiptId + '_' + hash(e.jobId).slice(0,24), jobId: e.jobId, appliedPaise: e.appliedPaise })),
  };
  const applications: VisitOnlineApplication[] = receipt.applications.map(a => ({ ...a, receiptId, tenantId: receipt.tenantId, studioId: receipt.studioId,
    customerId: receipt.customerId, visitId: receipt.visitId, billId: receipt.billId, attemptId: receipt.attemptId,
    method: receipt.method, currency: 'INR', recognisedAt: receipt.recognisedAt }));
  return { receipt, applications };
}

/** Finite money projection only after all originals reconcile. Callers supply
 * the COMPLETE application set queried by receipt identity, not just the job
 * they happen to be viewing. Unknown/private source fields do not escape. */
export function validateVisitOnlineReceiptProof(proof: {
  receipt: unknown; applications: unknown[]; attempt: VisitProviderAttempt; capture: unknown; event: unknown; bill: unknown; invoice: unknown;
}) {
  const { receipt, applications, attempt, capture, event, bill, invoice } = proof;
  const expected = planVisitOnlineReceipt(attempt, capture);
  if (!record(receipt) || !Array.isArray(applications) || !record(event) || !record(bill) || !record(invoice) || !record(capture)) return fail();
  for (const [key, value] of Object.entries(expected.receipt)) if (!isDeepStrictEqual(receipt[key], value)) return fail();
  if (applications.length !== expected.applications.length || new Set(applications.map(a => record(a) ? a['id'] : null)).size !== applications.length) return fail();
  for (const expectedRow of expected.applications) {
    const row = applications.find(a => record(a) && a['id'] === expectedRow.id);
    if (!record(row) || Object.entries(expectedRow).some(([key,value]) => !isDeepStrictEqual(row[key], value))) return fail();
  }
  const evidence = event['evidence'];
  if (!record(evidence) || event['outcome'] !== 'captured_review' || evidence['eventId'] !== capture['firstEventId'] ||
    !['payment.captured','payment_link.paid'].includes(evidence['eventType']) || evidence['referenceId'] !== attempt.id ||
    evidence['providerPaymentId'] !== capture['providerPaymentId'] || evidence['providerLinkId'] !== capture['providerLinkId'] ||
    evidence['providerOrderId'] !== capture['providerOrderId'] || evidence['amountPaise'] !== capture['amountPaise'] || evidence['currency'] !== 'INR' ||
    ['tenantId','studioId','visitId'].some(k => event[k] !== (attempt as any)[k]) || event['payloadHash'] !== hash(evidence)) return fail();
  if (bill['id'] !== attempt.billId || bill['kind'] !== 'visit_collection_bill' || bill['status'] !== 'prepared' || bill['sourceToken'] !== attempt.reviewToken ||
    ['tenantId','studioId','customerId','visitId'].some(k => bill[k] !== (attempt as any)[k]) || bill['currency'] !== 'INR' || bill['payablePaise'] !== attempt.amountPaise ||
    !isDeepStrictEqual(bill['lines'], attempt.review.lines)) return fail();
  const activeLines = attempt.review.lines.filter(line => !line.cancelled);
  if (bill['totalPaise'] !== activeLines.reduce((sum,line)=>sum+line.amountPaise,0) ||
    bill['previouslyAppliedPaise'] !== activeLines.reduce((sum,line)=>sum+line.appliedPaise,0) ||
    bill['membershipRevision'] !== attempt.review.revision) return fail();
  if (invoice['id'] !== receipt['invoiceId'] || invoice['kind'] !== 'shared_visit_invoice' || invoice['status'] !== 'issued' ||
    invoice['receiptId'] !== receipt['id'] || invoice['receiptSource'] !== 'visit_online_receipt' || invoice['sharedVisitId'] !== attempt.visitId ||
    ['tenantId','studioId','customerId'].some(k => invoice[k] !== (attempt as any)[k]) || invoice['currency'] !== 'INR' || invoice['sourceToken'] !== attempt.reviewToken ||
    !id(invoice['vehicleId']) || invoice['vehicleId'] !== bill['vehicleId'] || invoice['membershipRevision'] !== attempt.review.revision) return fail();
  // The invoice covers full unissued obligations, not merely the remaining
  // captured balance after previous partial receipts. Never rewrite paid originals.
  const issued = parseVisitInvoiceRead(invoice);
  const unissued = attempt.review.lines.filter(line => !line.cancelled && line.amountPaise > line.appliedPaise);
  if (issued.components.length !== unissued.length || issued.components.some(component => {
    const line = unissued.find(lineEntry91 => lineEntry91.jobId === component.jobId);
    return !line || component.amountPaise !== line.amountPaise;
  })) return fail();
  return { id: expected.receipt.id, recognisedAt: expected.receipt.recognisedAt, method: 'razorpay_payment_link' as const,
    currency: 'INR' as const, receivedPaise: expected.receipt.receivedPaise, invoiceId: expected.receipt.invoiceId };
}
