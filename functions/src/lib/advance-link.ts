// Advance payment link lifecycle (basket item 4 - PREVIEW, NOT ACTIVATED).
// Pure orchestration over injected deps: fully unit-testable with the flag
// off. Money-safety rules (reviewer 2 Nov 2026):
//  - A provider success whose DB patch failed must never be blind-retried
//    into a SECOND payable link. Ambiguity reconciles by provider lookup,
//    or fails closed to manual review. Never blind-create.
//  - Razorpay has no fetch-link-by-reference API: reconciliation fetches a
//    KNOWN provider link id. When the create response itself was lost (no
//    link id recorded), the provider state is unknowable to us, so the only
//    safe outcome is manual review.
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

export type AdvanceLinkDeps = {
  fetchLink(providerPaymentLinkId: string): Promise<{ id: string; amount: number; currency: string; paymentUrl: string } | null>;
  createLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult>;
  patch(patch: { paymentUrl: string; razorpayPaymentLinkId: string; razorpayOrderId: string | null }): Promise<void>;
  markAmbiguous(ambiguous: boolean): Promise<void>;
  flagManualReview(reason: string): Promise<void>;
};

export type AdvanceLinkOutcome =
  | { outcome: "link_ready"; paymentUrl: string }
  | { outcome: "manual_review" };

export async function ensureAdvanceLink(
  payment: AdvanceLinkState,
  linkParams: Omit<CreatePaymentLinkParams, "amount" | "currency">,
  deps: AdvanceLinkDeps,
): Promise<AdvanceLinkOutcome> {
  // 1. Already linked: idempotent replay, no provider call.
  if (payment.paymentUrl && payment.razorpayPaymentLinkId) {
    return { outcome: "link_ready", paymentUrl: payment.paymentUrl };
  }

  // 2. Ambiguous state: reconcile, never blind-create.
  if (payment.orderAmbiguous) {
    if (payment.razorpayPaymentLinkId) {
      let found: { id: string; amount: number; currency: string; paymentUrl: string } | null;
      try {
        found = await deps.fetchLink(payment.razorpayPaymentLinkId);
      } catch {
        // Provider unreachable: stay closed. A later retry reconciles.
        throw new Error("We are confirming your earlier payment link. Please try again in a few minutes.");
      }
      if (!found || found.amount !== payment.amount || found.currency !== payment.currency) {
        await deps.flagManualReview("advance link reconciliation mismatch");
        return { outcome: "manual_review" };
      }
      await deps.patch({ paymentUrl: found.paymentUrl, razorpayPaymentLinkId: found.id, razorpayOrderId: payment.razorpayOrderId });
      await deps.markAmbiguous(false);
      return { outcome: "link_ready", paymentUrl: found.paymentUrl };
    }
    // The create response itself was lost: the provider may hold a payable
    // link we cannot reference. Never create a second one.
    await deps.flagManualReview("advance link creation outcome unknown; provider reference unrecoverable");
    return { outcome: "manual_review" };
  }

  // 3. Fresh create. ANY failure after this point is ambiguous by definition:
  //    the provider may have created the link.
  let result: PaymentLinkResult;
  try {
    result = await deps.createLink({ ...linkParams, amount: payment.amount, currency: payment.currency });
  } catch (e) {
    await deps.markAmbiguous(true);
    throw e;
  }
  try {
    await deps.patch({ paymentUrl: result.paymentUrl, razorpayPaymentLinkId: result.providerPaymentLinkId, razorpayOrderId: result.providerOrderId });
  } catch (e) {
    // The provider link EXISTS (we have its id) but the record did not take
    // it. Ambiguous WITH a reference: the next retry reconciles via fetch.
    await deps.markAmbiguous(true);
    // Best-effort: keep the provider id so reconciliation is possible. If
    // even this write fails we are in the unrecoverable-reference branch.
    try {
      await deps.patch({ paymentUrl: result.paymentUrl, razorpayPaymentLinkId: result.providerPaymentLinkId, razorpayOrderId: result.providerOrderId });
    } catch { /* stays ambiguous; manual review path covers it */ }
    throw e;
  }
  return { outcome: "link_ready", paymentUrl: result.paymentUrl };
}
