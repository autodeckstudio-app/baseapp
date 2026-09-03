import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies a Razorpay webhook's `X-Razorpay-Signature` header per Razorpay's
 * publicly documented algorithm: HMAC-SHA256 over the exact raw request
 * body bytes, keyed with the studio's configured webhook secret, compared
 * as a hex digest.
 *
 * Implemented directly with Node's built-in `crypto` rather than an SDK
 * utility: this repository's Razorpay SDK integration only needed to
 * exercise the Orders/Refunds REST client (`razorpay.provider.ts`), and
 * this is a small, simple, auditable primitive that adds no dependency —
 * using it here keeps the one genuinely security-critical piece of Phase
 * 2J (webhook authentication) fully inspectable in a few lines, rather than
 * behind an SDK call whose internals aren't in this codebase.
 *
 * Uses a constant-time comparison (`timingSafeEqual`) to avoid leaking
 * information about how much of the signature matched via response-timing
 * side channels. Never logs the secret or the computed/expected digests.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  webhookSecret: string,
): boolean {
  if (!signature) {
    return false;
  }

  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(signature, 'utf8');

  // timingSafeEqual throws on a length mismatch rather than returning
  // false — checking length first keeps this safe for any input.
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
