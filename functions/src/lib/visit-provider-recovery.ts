import { isDeepStrictEqual } from 'node:util';
import type { PaymentLinkResult, PaymentProvider } from './payment-provider.js';
import { planVisitProviderLink, type VisitProviderAttempt } from './visit-provider-attempt.js';

/** A successful create response is a recovery hint only. It does not prove the
 * requested reference, amount or currency. Preserve it before fetching proof. */
export function assertVisitProviderCandidate(candidate: PaymentLinkResult): void {
  const id = (x: unknown) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(x);
  let url: URL;
  try { url = new URL(candidate.paymentUrl); } catch { throw new Error('Provider candidate needs review.'); }
  if (!id(candidate.providerPaymentLinkId) || candidate.providerOrderId !== null && !id(candidate.providerOrderId) ||
    url.protocol !== 'https:' || url.username || url.password) throw new Error('Provider candidate needs review.');
}
export function sameVisitProviderCandidate(a: PaymentLinkResult, b: PaymentLinkResult): boolean {
  assertVisitProviderCandidate(a); assertVisitProviderCandidate(b);
  return isDeepStrictEqual(a, b);
}

/** Provider fetch is evidence, never permission to create again. Missing
 * reference/amount/currency or a conflicting create hint cannot bind a link.
 * A paid/partial result stays recoverable but is NOT itself a capture journal. */
export function verifyVisitProviderFetchedLink(attempt: VisitProviderAttempt, candidate: PaymentLinkResult,
  fetched: Awaited<ReturnType<PaymentProvider['fetchPaymentLink']>>) {
  assertVisitProviderCandidate(candidate);
  if (!fetched || fetched.providerPaymentLinkId !== candidate.providerPaymentLinkId ||
    candidate.providerOrderId !== null && fetched.providerOrderId !== candidate.providerOrderId ||
    fetched.paymentUrl !== candidate.paymentUrl || !['created','partially_paid','paid','expired','cancelled'].includes(fetched.status))
    throw new Error('Provider fetched link needs review.');
  const evidence = { referenceId: fetched.evidence?.referenceId as string, amountPaise: fetched.amount, currency: fetched.currency,
    providerLinkId: fetched.providerPaymentLinkId, providerOrderId: fetched.providerOrderId, paymentUrl: fetched.paymentUrl };
  planVisitProviderLink(attempt, evidence);
  return evidence;
}
