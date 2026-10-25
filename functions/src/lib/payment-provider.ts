// Provider-agnostic payment abstraction.
// Business logic depends only on this interface — never on Razorpay directly.

export interface CreatePaymentLinkParams {
  amount: number; // paise — comes from booking.totalAmount, NEVER from client
  currency: string; // "INR"
  bookingId: string;
  description: string;
  customerName: string;
  customerPhone: string;
  referenceId: string; // idempotency key for the provider
}

export interface PaymentLinkResult {
  providerPaymentLinkId: string;
  providerOrderId: string | null;
  paymentUrl: string;
}

export interface InitiateRefundParams {
  providerPaymentId: string; // Razorpay payment ID (rzp_...)
  amount: number; // paise — full or partial
  reason: string;
  referenceId: string; // idempotency key
}

export interface RefundResult {
  providerRefundId: string;
}

export interface VerifyWebhookParams {
  rawBody: string;
  signature: string;
}

export type ProviderEventType =
  | "payment.captured"
  | "payment.failed"
  | "payment.link.paid"
  | "payment_link.paid" // documented Razorpay name
  | "refund.created"
  | "refund.failed";

export interface ProviderWebhookEvent {
  eventType: ProviderEventType;
  providerEventId: string; // idempotency key from provider
  providerPaymentId: string;
  providerPaymentLinkId: string | null;
  providerRefundId: string | null;
  // Refund-entity fields, when the event carries a refund: its own amount,
  // currency, and our durable receipt (the refund-outbox request id, or
  // refund_<paymentId> for the legacy path). Identity for outbox ownership
  // never rests on the payment entity alone.
  providerRefundAmount?: number | null;
  providerRefundCurrency?: string | null;
  providerRefundReceipt?: string | null;
  // The refund entity's OWN payment id and lifecycle status - distinct from
  // the payment entity's id. Binding evidence must come from the refund
  // entity itself; a missing or conflicting value never "agrees".
  providerRefundPaymentId?: string | null;
  providerRefundStatus?: string | null;
  providerOrderId?: string | null;
  referenceId?: string | null; // our payment doc id, set as reference_id on the payment link
  amount: number; // paise
  currency: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult>;
  verifyWebhookSignature(params: VerifyWebhookParams): boolean;
  parseWebhookEvent(rawBody: string): ProviderWebhookEvent;
  initiateRefund(params: InitiateRefundParams): Promise<RefundResult>;
}
