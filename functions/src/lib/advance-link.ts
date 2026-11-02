// Advance payment link lifecycle (basket item 4 - PREVIEW, NOT ACTIVATED).
// Pure orchestration over injected deps: fully unit-testable with the flag
// off. Money-safety rules (reviewer 2 Nov 2026):
//  - NEVER hand out a payable URL without validating it against the
//    provider FIRST. The expiry webhook can be delayed or missing and a
//    provider-side cancel or partial payment would leave a dead or
//    money-attached URL looking live. Reconcile-first, every time.
//  - A provider success whose DB patch failed must never be blind-retried
//    into a SECOND payable link. Ambiguity reconciles by provider lookup,
//    or fails closed to manual review. Never blind-create.
//  - A fresh link is created ONLY when no link id exists, or the provider
//    CONFIRMS the old one is expired/cancelled. paid / partially_paid /
//    unknown states fail closed - never create over possible money.
import type { CreatePaymentLinkParams, PaymentLinkResult } from "./payment-provider.js";

export type AdvanceLinkState = {
  id: string;
  amount: number;
  currency: string;
  paymentUrl: string | null;
  razorpayPaymentLinkId: string | null;
  razorpayOrderId: string | null;
  orderAmbiguous: boolean | null;
};

export type FetchedLink = { id: string; amount: number; currency: string; paymentUrl: string; status: string };

export type CreateClaim =
  /** We hold the exclusive create lease; ambiguity is pre-marked so a crash
   *  anywhere after this point fails CLOSED, never a blind second create. */
  | { kind: "acquired" }
  /** Another caller holds the lease. ambiguous=true means that creator
   *  crashed mid-create: provider state unknown, fail CLOSED to review. */
  | { kind: "held"; ambiguous: boolean }
  /** A link id was bound between our read and our claim: reconcile it. */
  | { kind: "linked"; linkId: string };

export type AdvanceLinkDeps = {
  fetchLink(providerPaymentLinkId: string): Promise<FetchedLink | null>;
  createLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult>;
  /** Exclusive provider-create claim (reviewer R1): exactly one caller may
   *  hold the lease for a payment; implemented as ONE transaction that
   *  requires no bound link id and no live lease, and pre-marks ambiguity. */
  claimCreate(leaseId: string, knownLinkId: string | null): Promise<CreateClaim>;
  /** Conflict-aware binding patch (reviewer R1): binds the created ids and
   *  clears the lease+ambiguity; if a DIFFERENT link id was bound first,
   *  appends THIS patch's ids to the append-only prior history instead
   *  (never an unbound payable loser) and reports the winner. */
  patch(patch: { paymentUrl: string | null; razorpayPaymentLinkId: string; razorpayOrderId: string | null;
    /** Ids of the link/order THIS patch replaces. The persistence layer
     *  appends them to priorLinkIds/priorOrderIds (append-only, reviewer
     *  G2) so a late capture on the old link still resolves. */
    superseded?: { linkId: string | null; orderId: string | null } }): Promise<{ bound: true } | { bound: false; winnerLinkId: string }>;
  /** Post-commit provider cancel for a LOST race's link (reviewer R1):
   *  the loser must never stay payable. */
  cancelLink(providerPaymentLinkId: string): Promise<{ outcome: string }>;
  markAmbiguous(ambiguous: boolean): Promise<void>;
  flagManualReview(reason: string): Promise<void>;
};

export type AdvanceLinkOutcome =
  | { outcome: "link_ready"; paymentUrl: string }
  | { outcome: "manual_review" };

// Razorpay payment-link statuses (official API reference). ACTIVE ones can
// still be paid; everything else is terminal or money-attached.
const ACTIVE = new Set(["created", "issued"]);
const INACTIVE = new Set(["expired", "cancelled"]);
const MONEY_ATTACHED = new Set(["paid", "partially_paid"]);

export async function ensureAdvanceLink(
  payment: AdvanceLinkState,
  linkParams: Omit<CreatePaymentLinkParams, "amount" | "currency">,
  deps: AdvanceLinkDeps,
): Promise<AdvanceLinkOutcome> {
  // Reconcile-first: whenever we hold a provider link id, validate it with
  // the provider before ANY return or create. This covers the stored-URL
  // replay (webhook may be delayed/missing), the cleared-URL retry, and the
  // ambiguous state in one flow.
  if (payment.razorpayPaymentLinkId) {
    let found: FetchedLink | null;
    try {
      found = await deps.fetchLink(payment.razorpayPaymentLinkId);
    } catch {
      // Provider unreachable: stay closed. A later retry reconciles.
      throw new Error("We are confirming your earlier payment link. Please try again in a few minutes.");
    }
    if (found) {
      if (MONEY_ATTACHED.has(found.status)) {
        // Money is (partly) attached provider-side. Never hand the URL out,
        // never create over it - a human reconciles with the webhook record.
        await deps.flagManualReview(`advance link provider status "${found.status}" while our record is pending`);
        return { outcome: "manual_review" };
      }
      if (ACTIVE.has(found.status)) {
        if (found.amount !== payment.amount || found.currency !== payment.currency) {
          await deps.flagManualReview("advance link reconciliation mismatch");
          return { outcome: "manual_review" };
        }
        if (payment.orderAmbiguous) {
          // Ambiguity resolved: the link exists and matches.
          await deps.patch({ paymentUrl: found.paymentUrl, razorpayPaymentLinkId: found.id, razorpayOrderId: payment.razorpayOrderId });
          await deps.markAmbiguous(false);
        } else if (!payment.paymentUrl) {
          // URL was cleared (expired/cancelled webhook) but the provider
          // says the link is still active: re-store it, no create.
          await deps.patch({ paymentUrl: found.paymentUrl, razorpayPaymentLinkId: found.id, razorpayOrderId: payment.razorpayOrderId });
        }
        return { outcome: "link_ready", paymentUrl: found.paymentUrl };
      }
      if (INACTIVE.has(found.status)) {
        if (payment.orderAmbiguous) {
          // The only link we can reference is dead AND a create outcome was
          // lost: a second link may exist provider-side that we cannot see.
          await deps.flagManualReview("advance link creation outcome unknown and the referenced link is inactive");
          return { outcome: "manual_review" };
        }
        // Provider CONFIRMS the old link is inactive: fall through to a
        // fresh create - it cannot duplicate a payable link.
      } else {
        await deps.flagManualReview(`advance link in unknown provider state "${found.status}"`);
        return { outcome: "manual_review" };
      }
    } else {
      if (payment.orderAmbiguous) {
        // The create response itself was lost and the provider has no such
        // link: the provider state is unknowable to us. Never blind-create.
        await deps.flagManualReview("advance link creation outcome unknown; provider reference unrecoverable");
        return { outcome: "manual_review" };
      }
      // We reference a link the provider has never heard of: nothing
      // payable exists, a fresh create is safe.
    }
  } else if (payment.orderAmbiguous) {
    // Ambiguous with NO reference at all: never blind-create.
    await deps.flagManualReview("advance link creation outcome unknown; no provider reference recorded");
    return { outcome: "manual_review" };
  }

  // Fresh create under the EXCLUSIVE lease (reviewer R1: double tap,
  // provider delay, crash - never an unbound payable loser). The claim
  // transaction pre-marks ambiguity, so a crash anywhere below fails CLOSED
  // on the next call instead of blind-creating a second payable link.
  const claim = await deps.claimCreate(`lease-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, payment.razorpayPaymentLinkId);
  if (claim.kind === "linked") {
    // Someone bound a DIFFERENT link between our read and our claim:
    // reconcile it through the same provider-first path, never trust it
    // blindly. Bounded recursion: each hop requires a NEW bound id.
    if ((payment as { __hops?: number }).__hops ?? 0 >= 3) {
      await deps.flagManualReview("advance link binding kept changing during reconciliation");
      return { outcome: "manual_review" };
    }
    return ensureAdvanceLink({ ...payment, razorpayPaymentLinkId: claim.linkId, __hops: ((payment as { __hops?: number }).__hops ?? 0) + 1 } as AdvanceLinkState, linkParams, deps);
  }
  if (claim.kind === "held") {
    if (claim.ambiguous) {
      await deps.flagManualReview("concurrent advance link create interrupted; provider state unknown. Ops: reconcile with the provider (fetch by referenceId and any prior/superseded ids) BEFORE clearing the lease; never blind reset or recreate");
      return { outcome: "manual_review" };
    }
    // A live create is in flight elsewhere: the retry reconciles.
    throw new Error("We are confirming your earlier payment link. Please try again in a few minutes.");
  }
  const superseded = { linkId: payment.razorpayPaymentLinkId, orderId: payment.razorpayOrderId };
  let result: PaymentLinkResult;
  try {
    result = await deps.createLink({ ...linkParams, amount: payment.amount, currency: payment.currency });
  } catch (e) {
    await deps.markAmbiguous(true);
    throw e;
  }
  let patchRes: { bound: true } | { bound: false; winnerLinkId: string };
  try {
    patchRes = await deps.patch({ paymentUrl: result.paymentUrl, razorpayPaymentLinkId: result.providerPaymentLinkId, razorpayOrderId: result.providerOrderId, superseded });
  } catch (e) {
    // The provider link EXISTS (we have its id) but the record did not take
    // it. Ambiguous WITH a reference: the next retry reconciles via fetch.
    await deps.markAmbiguous(true);
    // Best-effort: keep the provider id so reconciliation is possible. If
    // even this write fails we are in the unrecoverable-reference branch.
    try {
      await deps.patch({ paymentUrl: result.paymentUrl, razorpayPaymentLinkId: result.providerPaymentLinkId, razorpayOrderId: result.providerOrderId, superseded });
    } catch { /* stays ambiguous; manual review path covers it */ }
    throw e;
  }
  if (patchRes.bound) {
    return { outcome: "link_ready", paymentUrl: result.paymentUrl };
  }
  // LOST the race (reviewer R1): the winner's link is bound; OUR ids are
  // already in the append-only prior history (the conflict patch did it),
  // so no payable link is unbound. Cancel our loser at the provider -
  // failure surfaces as an actionable ops retry, never silent.
  let cancelOutcome: string;
  try {
    cancelOutcome = (await deps.cancelLink(result.providerPaymentLinkId)).outcome;
  } catch (e) {
    cancelOutcome = `cancel_failed: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (cancelOutcome !== "cancelled") {
    await deps.flagManualReview(`lost advance link race: provider cancel of ${result.providerPaymentLinkId} ended "${cancelOutcome}" - retry the provider cancel (no double collection while it stays payable)`);
    return { outcome: "manual_review" };
  }
  // Reconcile the WINNER provider-first and hand out only a validated URL.
  const winner = await deps.fetchLink(patchRes.winnerLinkId);
  if (winner && ACTIVE.has(winner.status) && winner.amount === payment.amount && winner.currency === payment.currency) {
    return { outcome: "link_ready", paymentUrl: winner.paymentUrl };
  }
  await deps.flagManualReview(`lost advance link race and the winning link ${patchRes.winnerLinkId} did not validate`);
  return { outcome: "manual_review" };
}
