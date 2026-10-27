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
  // Provider-reported refund lifecycle status at creation, when the provider
  // returns one ("processed" | "pending" | "failed" | ...). Absence means the
  // runner must reconcile via the bound lookup before projecting.
  status?: string | null;
}

export type RefundLookupResult =
  | { outcome: "found"; providerRefundId: string }
  // The provider reports a refund with our reference in status "failed".
  // Razorpay documents refund.failed only as "not able to process a refund" -
  // a failure NOTIFICATION, not settled finality: the provider contract does
  // not prove the same refund can never later process. The runner therefore
  // HOLDS the reservation for manual reconciliation on this evidence: never
  // releases the balance, never resubmits, never starts a new refund.
  | { outcome: "failed_confirmed"; providerRefundId: string }
  | { outcome: "absent_confirmed" }
  | { outcome: "unknown" };

// Owner-grounded identity for a refund lookup: the stored provider payment id
// anchors the query to OUR payment, and the refund must also match the exact
// amount and currency we reserved. Receipt alone is never identity.
export type RefundBinding = {
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
};

// Cancelling a payment link at the provider (Razorpay POST /v1/payment_links/:id/cancel,
// verified against the official API docs 28 Oct 2026). The booking that owns the
// link must only be cancelled AFTER the provider confirms one of these outcomes -
// never claim the link is dead on a hope.
export type CancelPaymentLinkResult =
  // Provider confirmed: status "cancelled". No new payment can start on it.
  | { outcome: "cancelled" }
  // 400 "cannot cancel or expire an expired link": already expired/cancelled.
  // The link is dead either way, so this is the idempotent repeat.
  | { outcome: "already_inactive" }
  // 400 "cannot cancel or expire an already paid/partially paid link": money
  // arrived or is partially in. FAIL CLOSED - the booking must stay and the
  // payment must be handled as arrived.
  | { outcome: "already_paid" }
  // 400 "an update is already in progress": provider holds a short-lived lock
  // on the link. Retry; nothing is known yet.
  | { outcome: "in_progress" };

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
  /** refund.entity.receipt: we send our refund request id as the receipt when submitting, so it binds an event to our request. */
  providerRefundReceipt?: string | null;
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
  cancelPaymentLink(providerPaymentLinkId: string): Promise<CancelPaymentLinkResult>;
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
  findRefundByReference?(referenceId: string, binding: RefundBinding): Promise<RefundLookupResult>;
}
