// After the checkout signature is verified, complete the payment through the same
// processor the webhook uses. The event id is derived from the provider payment id, so
// retries are duplicates and a later webhook finds the payment already completed.
import type { Firestore } from "firebase-admin/firestore";
import { processProviderEvent, type WebhookOutcome } from "./razorpay-webhook.js";

export async function completeVerifiedCheckout(
  db: Firestore,
  p: { paymentId: string; orderId: string; providerPaymentId: string },
): Promise<WebhookOutcome> {
  const r = await processProviderEvent(db, {
    eventType: "payment.captured",
    providerEventId: `verify_${p.providerPaymentId}`,
    providerPaymentId: p.providerPaymentId,
    providerPaymentLinkId: null,
    providerRefundId: null,
    providerOrderId: p.orderId,
    referenceId: p.paymentId,
    amount: 0, // amount was fixed server-side when the order was created; 0 skips the event amount check
    currency: "INR",
  });
  return r.outcome;
}
