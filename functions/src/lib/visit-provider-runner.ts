import type { Firestore } from 'firebase-admin/firestore';
import type { AuthorizedUser } from '@autodeck/auth';
import type { PaymentLinkResult, PaymentProvider } from './payment-provider.js';
import { beginVisitProviderSubmission, bindVisitProviderLink, markVisitProviderUncertain, readVisitProviderRecovery, saveVisitProviderCandidate } from './visit-provider-store.js';
import { verifyVisitProviderFetchedLink } from './visit-provider-recovery.js';

/** Deliberately NOT implemented by the production PaymentProvider. A visit is
 * not a booking: never pass its ID through legacy bookingId provider notes.
 * No scheduler, callable or webhook imports this qualification runner. */
export type VisitProviderPort = {
  createVisitPaymentLink(input: { visitId: string; billId: string; referenceId: string; amountPaise: number; currency: 'INR' }): Promise<PaymentLinkResult>;
  fetchPaymentLink: PaymentProvider['fetchPaymentLink'];
};

/** Dormant sequencer. All provider effects follow a committed first submit.
 * A missing candidate after that commit is an ambiguous create, not absence.
 * No capture/receipt/invoice projection, customer disclosure, unlock or retry
 * create is permitted here. The production activation flag remains false. */
export async function qualifyVisitProviderSubmission(db: Firestore, user: AuthorizedUser, visitId: string, attemptId: string, port: VisitProviderPort) {
  const recovery = await readVisitProviderRecovery(db, user, visitId, attemptId);
  if (recovery.attempt.link) return { outcome: recovery.attempt.state === 'link_ready' ? 'link_bound' as const : 'review_required' as const };
  let candidate = recovery.candidate;
  if (!candidate) {
    const command = await beginVisitProviderSubmission(db, user, visitId, attemptId);
    if (!command) return { outcome: 'review_required' as const };
    try {
      candidate = await port.createVisitPaymentLink({ visitId, billId: recovery.attempt.billId,
        referenceId: command.referenceId, amountPaise: command.amountPaise, currency: command.currency });
      await saveVisitProviderCandidate(db, user, visitId, attemptId, candidate);
    } catch {
      await markVisitProviderUncertain(db, user, visitId, attemptId);
      return { outcome: 'review_required' as const };
    }
  }
  try {
    const fresh = await readVisitProviderRecovery(db, user, visitId, attemptId);
    const fetched = await port.fetchPaymentLink(candidate.providerPaymentLinkId);
    const evidence = verifyVisitProviderFetchedLink(fresh.attempt, candidate, fetched);
    const bound = await bindVisitProviderLink(db, user, visitId, attemptId, evidence);
    return { outcome: bound.state === 'link_ready' ? 'link_bound' as const : 'review_required' as const };
  } catch {
    await markVisitProviderUncertain(db, user, visitId, attemptId);
    return { outcome: 'review_required' as const };
  }
}

/** Read-only, bounded discovery contract. A production implementation must
 * query the stored reference, reject truncation and return actual fetched
 * entities, not synthesize a match from the requested filter. No such adapter
 * is wired here. Zero results, timeout and partial pages are inconclusive. */
export type VisitProviderDiscoveryPort = Pick<VisitProviderPort, 'fetchPaymentLink'> & {
  findVisitPaymentLinks(referenceId: string): Promise<{
    complete: boolean;
    links: NonNullable<Awaited<ReturnType<PaymentProvider['fetchPaymentLink']>>>[];
  }>;
};
export async function qualifyVisitProviderDiscovery(db: Firestore, user: AuthorizedUser, visitId: string, attemptId: string, port: VisitProviderDiscoveryPort) {
  const current = await readVisitProviderRecovery(db, user, visitId, attemptId);
  if (current.attempt.link) return { outcome: current.attempt.state === 'link_ready' ? 'link_bound' as const : 'review_required' as const };
  if (current.candidate || !['submitting', 'uncertain'].includes(current.attempt.state)) return { outcome: 'review_required' as const };
  try {
    const result = await port.findVisitPaymentLinks(current.attempt.id);
    if (result.complete !== true || result.links.length !== 1) return { outcome: 'review_required' as const };
    const found = result.links[0]!;
    const candidate = { providerPaymentLinkId: found.providerPaymentLinkId, providerOrderId: found.providerOrderId, paymentUrl: found.paymentUrl };
    // Validate the returned entity before preserving any new identity. The
    // direct fetch below independently verifies that exact discovered link.
    verifyVisitProviderFetchedLink(current.attempt, candidate, found);
    await saveVisitProviderCandidate(db, user, visitId, attemptId, candidate);
    const direct = await port.fetchPaymentLink(candidate.providerPaymentLinkId);
    const evidence = verifyVisitProviderFetchedLink(current.attempt, candidate, direct);
    const bound = await bindVisitProviderLink(db, user, visitId, attemptId, evidence);
    return { outcome: bound.state === 'link_ready' ? 'link_bound' as const : 'review_required' as const };
  } catch {
    return { outcome: 'review_required' as const };
  }
}
