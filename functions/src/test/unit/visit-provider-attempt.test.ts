import { describe, expect, it } from 'vitest';
import { planVisitProviderCapture, planVisitProviderClaim, planVisitProviderLink, planVisitProviderSubmission, planVisitProviderUncertain, visitProviderCollectionEnabled, type VisitCaptureEvidence } from '../../lib/visit-provider-attempt';
const token = 'a'.repeat(64);
const input = () => ({ id: 'attempt-one', tenantId: 'tenant', studioId: 'studio', customerId: 'customer', billId: 'bill-one', reviewToken: token, expectedBalancePaise: 288000,
  review: { visitId: 'visit-one', revision: 2, lines: [
    { jobId: 'wash', amountPaise: 120000, appliedPaise: 24000, cancelled: false },
    { jobId: 'detail', amountPaise: 240000, appliedPaise: 48000, cancelled: false },
    { jobId: 'issued', amountPaise: 50000, appliedPaise: 50000, cancelled: false },
    { jobId: 'cancelled', amountPaise: 50000, appliedPaise: 0, cancelled: true },
    { jobId: 'covered', amountPaise: 0, appliedPaise: 0, cancelled: false },
  ] } });
const link = () => ({ referenceId: 'attempt-one', amountPaise: 288000, currency: 'INR', providerLinkId: 'plink_one', providerOrderId: 'order_one', paymentUrl: 'https://payments.example.invalid/one' });
const ready = () => planVisitProviderLink(planVisitProviderSubmission(planVisitProviderClaim(input())).attempt, link());
const capture = (): VisitCaptureEvidence => ({ eventType: 'payment.captured', eventId: 'event_one', referenceId: 'attempt-one', providerPaymentId: 'pay_one', providerLinkId: 'plink_one', providerOrderId: 'order_one', amountPaise: 288000, currency: 'INR' });

describe('disabled visit-wide provider attempt planner, no provider or Firestore effects', () => {
  it('activation stays off', () => expect(visitProviderCollectionEnabled()).toBe(false));
  it('freezes only exact remaining balance and independent allocations without rewriting original input', () => {
    const original = input(), snapshot = structuredClone(original), attempt = planVisitProviderClaim(original);
    expect(attempt.allocation).toMatchObject({ receivedPaise: 288000, balancePaise: 0, entries: [{ jobId: 'detail', appliedPaise: 192000 }, { jobId: 'wash', appliedPaise: 96000 }] });
    expect(original).toEqual(snapshot);
    original.review.lines[0]!.amountPaise = 1;
    expect(attempt.review.lines[0]!.amountPaise).toBe(120000);
  });
  it.each([0, -1, NaN, Infinity, 1.5, 287999, 288001, Number.MAX_SAFE_INTEGER + 1])('rejects changed or invalid balance %s', n => expect(() => planVisitProviderClaim({ ...input(), expectedBalancePaise: n })).toThrow());
  it('only a durably saved first submission emits a create command', () => {
    const first = planVisitProviderSubmission(planVisitProviderClaim(input()));
    expect(first.command).toEqual({ kind: 'create_visit_payment_link', referenceId: 'attempt-one', amountPaise: 288000, currency: 'INR' });
    expect(planVisitProviderSubmission(first.attempt).command).toBeNull();
    const lost = planVisitProviderUncertain(first.attempt);
    expect(lost.state).toBe('uncertain');
    for (let n = 0; n < 10; n++) expect(planVisitProviderSubmission(lost).command).toBeNull();
    expect(planVisitProviderLink(lost, link()).state).toBe('link_ready');
  });
  it('no timeout, link expiry, cancellation or failed payment releases a provider attempt', () => {
    const attempt = ready();
    for (const eventType of ['payment.failed', 'payment_link.expired', 'payment_link.cancelled', 'refund.processed', 'unknown']) {
      expect(planVisitProviderCapture(attempt, { ...capture(), eventType }, token)).toEqual({ attempt, outcome: 'held', allocation: null });
      expect(planVisitProviderSubmission(attempt).command).toBeNull();
    }
  });
  it.each([{ referenceId: 'other' }, { amountPaise: 1 }, { currency: 'USD' }, { providerLinkId: '' }, { providerOrderId: '' }, { paymentUrl: 'http://payments.example.invalid/one' }, { paymentUrl: 'https://user:password@example.invalid/' }, { paymentUrl: 'javascript:alert(1)' }])('link result must bind exact claim: %j', patch => {
    const submitting = planVisitProviderSubmission(planVisitProviderClaim(input())).attempt;
    expect(() => planVisitProviderLink(submitting, { ...link(), ...patch })).toThrow();
    expect(submitting.link).toBeNull();
  });
  it('persisted link cannot be rebound and identical persistence retry is harmless', () => {
    const attempt = ready();
    expect(planVisitProviderLink(attempt, link())).toBe(attempt);
    expect(() => planVisitProviderLink(attempt, { ...link(), providerLinkId: 'plink_two' })).toThrow();
    expect(() => planVisitProviderLink(planVisitProviderClaim(input()), link())).toThrow();
  });
  it.each([{ eventId: '' }, { providerPaymentId: '' }, { referenceId: 'other' }, { amountPaise: 287999 }, { amountPaise: 288001 }, { amountPaise: NaN }, { currency: 'USD' }, { providerLinkId: 'plink_other' }, { providerOrderId: null }, { providerOrderId: 'order_other' }])('capture never binds through partial matching: %j', patch => {
    const attempt = ready();
    expect(planVisitProviderCapture(attempt, { ...capture(), ...patch }, token)).toEqual({ attempt, outcome: 'held', allocation: null });
    expect(attempt.capture).toBeNull();
  });
  it('capture before link persistence is held until owner-bound reconciliation saves the link', () => {
    const uncertain = planVisitProviderUncertain(planVisitProviderSubmission(planVisitProviderClaim(input())).attempt);
    expect(planVisitProviderCapture(uncertain, capture(), token).outcome).toBe('held');
    expect(planVisitProviderCapture(planVisitProviderLink(uncertain, link()), capture(), token).outcome).toBe('captured');
  });
  it('two webhook names and distinct event ids for one payment produce one allocation', () => {
    const attempt = ready(), first = planVisitProviderCapture(attempt, capture(), token);
    expect(first.outcome).toBe('captured');
    expect(first.allocation).toEqual(attempt.allocation);
    const duplicate = planVisitProviderCapture(first.attempt, { ...capture(), eventType: 'payment_link.paid', eventId: 'event_two' }, token);
    expect(duplicate.outcome).toBe('duplicate');
    expect(duplicate.allocation).toBeNull();
    expect(duplicate.attempt.capture?.firstEventId).toBe('event_one');
    expect(planVisitProviderSubmission(duplicate.attempt).command).toBeNull();
  });
  it('another captured payment is held separately, never replaces or reapplies the first', () => {
    const first = planVisitProviderCapture(ready(), capture(), token);
    const second = planVisitProviderCapture(first.attempt, { ...capture(), eventId: 'event_two', providerPaymentId: 'pay_two' }, token);
    expect(second).toEqual({ attempt: first.attempt, outcome: 'extra_capture_review', allocation: null });
  });
  it.each(['b'.repeat(64), '', 'bad'])('capture after bill changes preserves money evidence but allocates nothing: %s', current => {
    const result = planVisitProviderCapture(ready(), capture(), current);
    expect(result).toMatchObject({ outcome: 'captured_review', allocation: null, attempt: { state: 'captured_review', capture: { providerPaymentId: 'pay_one', amountPaise: 288000 } } });
    expect(planVisitProviderCapture(result.attempt, capture(), token).allocation).toBeNull();
    expect(planVisitProviderSubmission(result.attempt).command).toBeNull();
  });
  it.each(['allocation', 'amount', 'scope', 'token', 'state', 'link', 'capture'])('corrupted persisted attempt cannot emit commands or apply captures: %s', kind => {
    const attempt = structuredClone(ready());
    if (kind === 'allocation') attempt.allocation.entries[0]!.appliedPaise++;
    if (kind === 'amount') attempt.amountPaise--;
    if (kind === 'scope') attempt.visitId = 'other';
    if (kind === 'token') attempt.reviewToken = 'bad';
    if (kind === 'state') (attempt as any).state = 'unknown';
    if (kind === 'link') attempt.link = null;
    if (kind === 'capture') (attempt as any).capture = { providerPaymentId: 'pay_one' };
    expect(() => planVisitProviderSubmission(attempt)).toThrow();
    expect(() => planVisitProviderCapture(attempt, capture(), token)).toThrow();
  });
});
it('provider reference fits the current 40 character API limit and longer claims cannot emit create',()=>{expect(()=>planVisitProviderClaim({...input(),id:'x'.repeat(41)})).toThrow();const max=planVisitProviderClaim({...input(),id:'x'.repeat(40)});expect(planVisitProviderSubmission(max).command?.referenceId).toHaveLength(40)});
