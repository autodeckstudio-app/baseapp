import Razorpay from 'razorpay';

export const RAZORPAY_CLIENT = Symbol('RAZORPAY_CLIENT');

/**
 * Constructs the official Razorpay SDK client, authenticated with the
 * studio's key pair. Used for the two outbound REST calls this backend
 * makes: creating an order (PaymentsService.createPaymentOrder) and issuing
 * a refund (PaymentsService.processRefund). Never used for anything
 * webhook-related — inbound webhook authenticity is verified independently
 * via `razorpay-signature.util.ts`, which needs no SDK client at all.
 */
export function createRazorpayClient(config: { keyId: string; keySecret: string }): Razorpay {
  return new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
}
