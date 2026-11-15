import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { planVisitProviderClaim, planVisitProviderSubmission, planVisitProviderLink, planVisitProviderCapture } from '../../lib/visit-provider-attempt.js';
import { planVisitOnlineReceipt, validateVisitOnlineReceiptProof } from '../../lib/visit-online-receipt.js';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fixture() {
  const token = 'a'.repeat(64), review = { visitId: 'v', revision: 2, lines: [
    { jobId: 'wash', amountPaise: 120000, appliedPaise: 24000, cancelled: false },
    { jobId: 'detail', amountPaise: 240000, appliedPaise: 48000, cancelled: false },
    { jobId: 'paid', amountPaise: 50000, appliedPaise: 50000, cancelled: false },
    { jobId: 'cancelled', amountPaise: 50000, appliedPaise: 0, cancelled: true },
    { jobId: 'covered', amountPaise: 0, appliedPaise: 0, cancelled: false },
  ] };
  const claim = planVisitProviderClaim({ id: 'vp_one', tenantId: 't', studioId: 's', customerId: 'c', billId: 'bill_one', reviewToken: token, expectedBalancePaise: 288000, review });
  const link = planVisitProviderLink(planVisitProviderSubmission(claim).attempt, { referenceId: claim.id, amountPaise: claim.amountPaise, currency: 'INR', providerLinkId: 'plink_one', providerOrderId: 'order_one', paymentUrl: 'https://payments.example.invalid/one' });
  const evidence = { eventType: 'payment.captured', eventId: 'event_one', referenceId: claim.id, providerPaymentId: 'pay_one', providerLinkId: 'plink_one', providerOrderId: 'order_one', amountPaise: claim.amountPaise, currency: 'INR' };
  const attempt = planVisitProviderCapture(link, evidence, '').attempt;
  const recognisedAt = '2026-11-14T18:45:00.000Z';
  const capture = { id: 'vc_' + hash(evidence.providerPaymentId), providerPaymentId: evidence.providerPaymentId, attemptId: attempt.id, tenantId: 't', studioId: 's', visitId: 'v', providerLinkId: 'plink_one', providerOrderId: 'order_one', amountPaise: claim.amountPaise, currency: 'INR', firstEventId: evidence.eventId, status: 'review_required', createdAt: recognisedAt };
  const planned = planVisitOnlineReceipt(attempt, capture);
  const event = { evidence, payloadHash: hash(evidence), outcome: 'captured_review', tenantId: 't', studioId: 's', visitId: 'v' };
  const bill = { id: 'bill_one', kind: 'visit_collection_bill', status: 'prepared', sourceToken: token, tenantId: 't', studioId: 's', customerId: 'c', visitId: 'v', currency: 'INR', payablePaise: claim.amountPaise, totalPaise: 410000, previouslyAppliedPaise: 122000, membershipRevision: 2, vehicleId: 'car', lines: review.lines };
  const components = review.lines.filter(l => l.amountPaise > l.appliedPaise && !l.cancelled).map(l => ({ jobId: l.jobId, amountPaise: l.amountPaise, subtotalPaise: l.amountPaise, discountPaise: 0, taxPaise: 0, roundOffPaise: 0, taxRatePercent: 0, taxDescription: 'No tax', lineItems: [{ description: l.jobId, quantity: 1, unitPrice: l.amountPaise, total: l.amountPaise }] }));
  const invoice = { id: planned.receipt.invoiceId, kind: 'shared_visit_invoice', status: 'issued', receiptId: planned.receipt.id, receiptSource: 'visit_online_receipt', sharedVisitId: 'v', tenantId: 't', studioId: 's', customerId: 'c', currency: 'INR', sourceToken: token, vehicleId: 'car', membershipRevision: 2, invoiceNumber: 'INV-TEST', issuedAt: recognisedAt, totalPaise: 360000, subtotalPaise: 360000, discountPaise: 0, taxPaise: 0, roundOffPaise: 0, customerSnapshot: { name: 'Fixture customer' }, vehicleSnapshot: { registrationNumber: 'TEST CAR' }, components };
  return { attempt, capture, ...planned, event, bill, invoice };
}
it('online journal preserves remaining capture separately from complete invoice obligations', () => {
  const f = fixture(), before = structuredClone(f), projected = validateVisitOnlineReceiptProof(f);
  expect(projected).toMatchObject({ method: 'razorpay_payment_link', currency: 'INR', receivedPaise: 288000, recognisedAt: f.capture.createdAt });
  expect(f.invoice.totalPaise).toBe(360000);
  expect(f.applications).toHaveLength(2);
  expect(f.applications.map(a => ({ jobId: a.jobId, amount: a.appliedPaise }))).toEqual([{ jobId: 'detail', amount: 192000 }, { jobId: 'wash', amount: 96000 }]);
  expect(f).toEqual(before);
});
it('finite money projection excludes all private references and identifies server recognition rather than invented capture time', () => {
  const f = fixture();
  Object.assign(f.receipt, { privateReference: 'PRIVATE', providerCaptureTime: 'PRIVATE' });
  Object.assign(f.invoice, { pdfUrl: 'PRIVATE' });
  const row = validateVisitOnlineReceiptProof(f);
  expect(Object.keys(row).sort()).toEqual(['currency','id','invoiceId','method','receivedPaise','recognisedAt']);
  expect(JSON.stringify(row)).not.toContain('PRIVATE');
  expect(row.recognisedAt).toBe(f.capture.createdAt);
});
it.each(['id','kind','tenantId','studioId','customerId','visitId','billId','attemptId','captureId','providerPaymentId','method','currency','recognisedAt','invoiceId','receivedPaise'])('receipt %s must exactly match original claim/capture', key => {
  const f = fixture(); (f.receipt as any)[key] = key === 'receivedPaise' ? 1 : 'other';
  expect(() => validateVisitOnlineReceiptProof(f)).toThrow();
});
it.each(['id','receiptId','tenantId','studioId','customerId','visitId','billId','attemptId','jobId','appliedPaise','method','currency','recognisedAt'])('application %s must match original and siblings', key => {
  const f = fixture(); (f.applications[0] as any)[key] = key === 'appliedPaise' ? 1 : 'other';
  expect(() => validateVisitOnlineReceiptProof(f)).toThrow();
});
it.each(['missing','extra','duplicate','parent-extra'])('requires complete one-to-one application set: %s', kind => {
  const f = fixture();
  if (kind === 'missing') f.applications.pop();
  if (kind === 'extra') f.applications.push({ ...f.applications[0]!, id: 'extra', jobId: 'outside' });
  if (kind === 'duplicate') f.applications[1] = f.applications[0]!;
  if (kind === 'parent-extra') f.receipt.applications.push({ id: 'extra', jobId: 'outside', appliedPaise: 1 });
  expect(() => validateVisitOnlineReceiptProof(f)).toThrow();
});
it.each(['id','providerPaymentId','attemptId','tenantId','studioId','visitId','amountPaise','currency','providerLinkId','providerOrderId','firstEventId','status','createdAt'])('capture %s binds complete owner evidence', key => {
  const f = fixture(); (f.capture as any)[key] = key === 'amountPaise' ? 1 : 'other';
  expect(() => validateVisitOnlineReceiptProof(f)).toThrow();
});
it.each(['eventId','referenceId','providerPaymentId','providerLinkId','providerOrderId','amountPaise','currency','eventType'])('event %s cannot be replaced even with a recomputed payload hash', key => {
  const f = fixture(); (f.event.evidence as any)[key] = key === 'amountPaise' ? 1 : 'other'; f.event.payloadHash = hash(f.event.evidence);
  expect(() => validateVisitOnlineReceiptProof(f)).toThrow();
});
it.each(['id','kind','status','sourceToken','tenantId','studioId','customerId','visitId','currency','payablePaise','totalPaise','previouslyAppliedPaise','membershipRevision','vehicleId','lines'])('prepared bill %s must match exact review', key => {
  const f = fixture(); (f.bill as any)[key] = key === 'payablePaise' ? 1 : 'other';
  expect(() => validateVisitOnlineReceiptProof(f)).toThrow();
});
it.each(['id','kind','status','receiptId','receiptSource','sharedVisitId','tenantId','studioId','customerId','currency','sourceToken','membershipRevision','vehicleId','totalPaise','components'])('issued invoice %s must match original receipt and unissued obligations', key => {
  const f = fixture(); (f.invoice as any)[key] = key === 'totalPaise' ? 1 : 'other';
  expect(() => validateVisitOnlineReceiptProof(f)).toThrow();
});
it('balanced but redistributed invoice components cannot reprice independent services', () => {
  const f = fixture();
  f.invoice.components[0]!.amountPaise += 100;
  f.invoice.components[0]!.subtotalPaise += 100;
  f.invoice.components[0]!.lineItems[0]!.unitPrice += 100;
  f.invoice.components[0]!.lineItems[0]!.total += 100;
  f.invoice.components[1]!.amountPaise -= 100;
  f.invoice.components[1]!.subtotalPaise -= 100;
  f.invoice.components[1]!.lineItems[0]!.unitPrice -= 100;
  f.invoice.components[1]!.lineItems[0]!.total -= 100;
  expect(() => validateVisitOnlineReceiptProof(f)).toThrow();
});
it('online totals count one receipt rather than application rows and use studio recognition day/month',async()=>{const{visitOnlineLedgerTotals}=await import('../../lib/visit-online-ledger.js'),row=validateVisitOnlineReceiptProof(fixture());expect(visitOnlineLedgerTotals([row],'2026-11-15')).toEqual({receivedPaise:288000,paymentCount:1,receivedByDay:{'2026-11-15':288000}});expect(visitOnlineLedgerTotals([row],'2026-11-14').receivedPaise).toBe(0);expect(visitOnlineLedgerTotals([row],'2026-11').paymentCount).toBe(1);expect(visitOnlineLedgerTotals([row],'2026-12').paymentCount).toBe(0);expect(()=>visitOnlineLedgerTotals([row,row],'2026-11')).toThrow();});
it.each([{receivedPaise:NaN},{receivedPaise:1.5},{receivedPaise:0},{recognisedAt:'bad'},{currency:'USD'},{method:'cash'}])('online totals reject malformed journal row %j',async patch=>{const{visitOnlineLedgerTotals}=await import('../../lib/visit-online-ledger.js'),row=validateVisitOnlineReceiptProof(fixture());expect(()=>visitOnlineLedgerTotals([{...row,...patch}as any],'2026-11')).toThrow()});
