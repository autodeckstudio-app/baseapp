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

export type RefundLookupResult =
  | { outcome: "found"; providerRefundId: string }
  | { outcome: "absent_confirmed" }
  | { outcome: "unknown" };

export interface VerifyWebhookParams {
  rawBody: string;
  signature: string;
}

export type ProviderEventType =
  | "payment.captured"
  | "payment.failed"
  | "payment.link.paid"
  | "payment_link.paid" // documented Razorpay name
  | "payment_link.expired"
  | "payment_link.cancelled"
  | "refund.created"
  | "refund.processed"
  | "refund.failed";

export interface ProviderWebhookEvent {
  eventType: ProviderEventType;
  providerEventId: string; // idempotency key from provider
  providerPaymentId: string;
  providerPaymentLinkId: string | null;
  providerRefundId: string | null;
  /** Paise of the REFUND entity itself (refund events only); `amount` is the payment amount when a payment entity is present. */
  providerRefundAmount?: number | null;
  /** Currency of the REFUND entity itself (refund events only). */
  providerRefundCurrency?: string | null;
  /** refund.entity.payment_id and payment.entity.id/currency kept SEPARATE so a handler can fail closed on a conflict. */
  providerRefundPaymentId?: string | null;
  providerPaymentEntityId?: string | null;
  providerPaymentEntityCurrency?: string | null;
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
  /**
   * Looks up a refund WE submitted, by our durable reference id, to reconcile
   * an ambiguous submit WITHOUT ever blindly resubmitting. Tri-state:
   *  - found: the provider has the refund — project it.
   *  - absent_confirmed: the provider's reconciliation contract AUTHORITATIVELY
   *    establishes no committed refund exists for the reference — only then
   *    may the reservation fail and the balance release.
   *  - unknown: not found, index delay, timeout, partial search — INCONCLUSIVE.
   *    The reservation stays held; absence of evidence is not evidence of
   *    absence. Optional: a provider without a lookup contract leaves this
   *    undefined and every ambiguous hold awaits manual reconciliation.
   */
  findRefundByReference?(referenceId: string): Promise<RefundLookupResult>;
}
