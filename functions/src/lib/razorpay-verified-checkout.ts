// After the checkout signature is verified, complete the payment through the same
// processor the webhook uses. The event id is derived from the provider payment id, so
// retries are duplicates and a later webhook finds the payment already completed.
import type { Firestore } from "firebase-admin/firestore";
import { processProviderEvent, type WebhookOutcome } from "./razorpay-webhook.js";

export async function completeVerifiedCheckout(
  db: Firestore,
  p: { paymentId: string; orderId: string; providerPaymentId: string },
): Promise<WebhookOutcome> {
  const payment=(await db.collection("payments").doc(p.paymentId).get()).data();
  if(!payment||payment["razorpayOrderId"]!==p.orderId||!Number.isSafeInteger(payment["amount"])||payment["amount"]<=0||payment["currency"]!=="INR") return "amount_mismatch";
  const r = await processProviderEvent(db, {
    eventType: "payment.captured",
    providerEventId: `verify_${p.providerPaymentId}`,
    providerPaymentId: p.providerPaymentId,
    providerPaymentLinkId: null,
    providerRefundId: null,
    providerOrderId: p.orderId,
    referenceId: p.paymentId,
    amount: payment["amount"], // Verified server-created order retains its exact immutable amount.
    currency: "INR",
  });
  return r.outcome;
}
