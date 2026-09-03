import { createHmac } from 'crypto';
import { verifyRazorpayWebhookSignature } from './razorpay-signature.util';

describe('verifyRazorpayWebhookSignature', () => {
  const secret = 'test-secret';
  const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));

  it('accepts a correctly computed signature', () => {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyRazorpayWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const signature = createHmac('sha256', 'wrong-secret').update(body).digest('hex');
    expect(verifyRazorpayWebhookSignature(body, signature, secret)).toBe(false);
  });

  it('rejects a signature computed over a different (tampered) body', () => {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const tamperedBody = Buffer.from(JSON.stringify({ event: 'payment.captured', amount: 999999999 }));
    expect(verifyRazorpayWebhookSignature(tamperedBody, signature, secret)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyRazorpayWebhookSignature(body, undefined, secret)).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    expect(() => verifyRazorpayWebhookSignature(body, 'short', secret)).not.toThrow();
    expect(verifyRazorpayWebhookSignature(body, 'short', secret)).toBe(false);
  });

  it('rejects an empty string signature', () => {
    expect(verifyRazorpayWebhookSignature(body, '', secret)).toBe(false);
  });
});
