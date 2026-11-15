import type { PaymentProvider } from './payment-provider.js';

type Link = NonNullable<Awaited<ReturnType<PaymentProvider['fetchPaymentLink']>>>;
export type CashLinkBinding = { linkId: string; paymentId: string; amount: number; currency: string };
export type CashLinkVerdict = 'cancel' | 'inactive_zero' | 'review';
/** Bound provider facts only. Missing/null capture evidence is distinct from zero.
 * Razorpay documents payments:null until capture and [] in cancel responses. */
export function classifyCashLink(link: Link | null, b: CashLinkBinding): CashLinkVerdict {
  if (!link || link.providerPaymentLinkId !== b.linkId || link.amount !== b.amount ||
      !Number.isSafeInteger(b.amount) || b.amount <= 0 || b.currency !== 'INR' ||
      link.currency !== b.currency || link.evidence?.referenceId !== b.paymentId ||
      link.evidence.amountPaid !== 0) return 'review';
  const captures = link.evidence.payments;
  if (captures !== null && (!Array.isArray(captures) || captures.length !== 0)) return 'review';
  if (link.status === 'created') return 'cancel';
  if (link.status === 'cancelled' || link.status === 'expired') return 'inactive_zero';
  return 'review';
}

/** No provider request is run inside a retryable database transaction. A cancel
 * response alone is never settlement evidence: always fetch the bound link again. */
export async function closeCashLink(provider: PaymentProvider, binding: CashLinkBinding) {
  const before = await provider.fetchPaymentLink(binding.linkId);
  const verdict = classifyCashLink(before, binding);
  if (verdict === 'review') return { outcome: 'review' as const, before, after: null };
  if (verdict === 'inactive_zero') return { outcome: 'ready' as const, before, after: before };
  const cancellation = await provider.cancelPaymentLink(binding.linkId);
  // Even an error mapping to already_inactive is NOT proof of zero captures.
  if (cancellation.outcome === 'already_paid' || cancellation.outcome === 'in_progress')
    return { outcome: 'review' as const, before, after: null };
  const after = await provider.fetchPaymentLink(binding.linkId);
  return { outcome: classifyCashLink(after, binding) === 'inactive_zero' ? 'ready' as const : 'review' as const, before, after };
}
