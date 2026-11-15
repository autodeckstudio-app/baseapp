// Checkout order creation that survives a lost provider response. One payment gets one
// Razorpay order: a stored order id is always reused, and after an ambiguous provider call
// (the order may exist at Razorpay but the response never arrived) creation fails closed
// until the provider is asked by receipt whether that order exists. Only a provider-confirmed
// answer unlocks a fresh order, so money is never chased to two orders for one payment.
import type { Payment } from "@autodeck/core";

export interface CheckoutOrderDeps {
  createOrder: (p: { amount: number; currency: string; receipt: string }) => Promise<{ id: string; amount: number; currency: string }>;
  findOrderByReceipt: (receipt: string) => Promise<{ id: string; amount: number; currency: string } | null>;
  saveOrder: (orderId: string) => Promise<void>;
  markAmbiguous: (ambiguous: boolean) => Promise<void>;
}

export class CheckoutOrderError extends Error {
  constructor(public code: "unavailable" | "ambiguous", message: string) { super(message); }
}

/** The order for a payment: the stored one, the reconciled one, or a fresh one. */
export async function obtainCheckoutOrder(payment: Payment, deps: CheckoutOrderDeps): Promise<{ orderId: string; amount: number; currency: string; reused: boolean }> {
  // 1. Already have one: reuse it. A retried tap never mints a second order.
  if (payment.razorpayOrderId) {
    return { orderId: payment.razorpayOrderId, amount: payment.amount, currency: payment.currency, reused: true };
  }

  // 2. Ambiguous: the provider may already hold this order. Ask by receipt before doing anything.
  if (payment.orderAmbiguous) {
    let found: { id: string; amount: number; currency: string } | null;
    try {
      found = await deps.findOrderByReceipt(payment.id);
    } catch {
      // Provider unreachable: stay closed. A retry reconciles later; nothing new is created.
      throw new CheckoutOrderError("ambiguous", "We are confirming your earlier payment attempt. Please try again in a few minutes.");
    }
    if (found) {
      if (found.amount !== payment.amount) throw new CheckoutOrderError("ambiguous", "We are confirming your earlier payment attempt. Please try again in a few minutes.");
      await deps.saveOrder(found.id);
      await deps.markAmbiguous(false);
      return { orderId: found.id, amount: found.amount, currency: found.currency, reused: true };
    }
    // Provider confirms no order exists: safe to clear and create below.
    await deps.markAmbiguous(false);
  }

  // 3. Create. A failure here is ambiguous by definition: the order may exist provider-side.
  try {
    const order = await deps.createOrder({ amount: payment.amount, currency: payment.currency, receipt: payment.id });
    await deps.saveOrder(order.id);
    return { orderId: order.id, amount: order.amount, currency: order.currency, reused: false };
  } catch (err) {
    await deps.markAmbiguous(true).catch(() => undefined);
    throw new CheckoutOrderError("unavailable", "Could not start the payment. Please try again.");
  }
}
