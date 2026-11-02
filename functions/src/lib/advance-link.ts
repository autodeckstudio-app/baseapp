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

export type AdvanceLinkDeps = {
  fetchLink(providerPaymentLinkId: string): Promise<FetchedLink | null>;
  createLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult>;
  patch(patch: { paymentUrl: string | null; razorpayPaymentLinkId: string; razorpayOrderId: string | null;
    /** Ids of the link/order THIS patch replaces. The persistence layer
     *  appends them to priorLinkIds/priorOrderIds (append-only, reviewer
     *  G2) so a late capture on the old link still resolves. */
    superseded?: { linkId: string | null; orderId: string | null } }): Promise<void>;
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

  // Fresh create. ANY failure after this point is ambiguous by definition:
  // the provider may have created the link. The replaced link/order ids
  // (when any) ride along so persistence appends them to the history.
  const superseded = { linkId: payment.razorpayPaymentLinkId, orderId: payment.razorpayOrderId };
  let result: PaymentLinkResult;
  try {
    result = await deps.createLink({ ...linkParams, amount: payment.amount, currency: payment.currency });
  } catch (e) {
    await deps.markAmbiguous(true);
    throw e;
  }
  try {
    await deps.patch({ paymentUrl: result.paymentUrl, razorpayPaymentLinkId: result.providerPaymentLinkId, razorpayOrderId: result.providerOrderId, superseded });
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
  return { outcome: "link_ready", paymentUrl: result.paymentUrl };
}
