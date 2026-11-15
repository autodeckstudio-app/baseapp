import { describe, it, expect } from "vitest";
import { checkoutSignature, signatureMatches } from "../../lib/razorpay-checkout.js";

describe("razorpay checkout signature", () => {
  it("matches the HMAC-SHA256 of order|payment", () => {
    const sig = checkoutSignature("order_1", "pay_1", "secret");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(signatureMatches("order_1", "pay_1", sig, "secret")).toBe(true);
  });
  it("rejects a wrong secret, id or length", () => {
    const sig = checkoutSignature("order_1", "pay_1", "secret");
    expect(signatureMatches("order_1", "pay_1", sig, "other")).toBe(false);
    expect(signatureMatches("order_2", "pay_1", sig, "secret")).toBe(false);
    expect(signatureMatches("order_1", "pay_1", "abc", "secret")).toBe(false);
  });
});
