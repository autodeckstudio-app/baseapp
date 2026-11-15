import { describe, it, expect, vi } from "vitest";

vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: () => undefined }));

import { completeVerifiedCheckout } from "../../lib/razorpay-verified-checkout.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { fakeFirestore } from "./fake-firestore.js";

const seed = () => ({
  memberships: { m1: { id: "m1", tenantId: "t", status: "pending" } },
  payments: { pay1: { id: "pay1", tenantId: "t", studioId: null, targetType: "membership", membershipId: "m1", customerId: "c1", amount: 149900, currency: "INR", method: "razorpay_checkout", status: "processing", razorpayOrderId: "order_1", razorpayPaymentId: "pay_x" } },
}) as never;

describe("completeVerifiedCheckout", () => {
  it("activates the pending membership and completes the payment", async () => {
    const { db, data } = fakeFirestore(seed());
    expect(await completeVerifiedCheckout(db as never, { paymentId: "pay1", orderId: "order_1", providerPaymentId: "pay_x" })).toBe("completed");
    expect(data["memberships"]!["m1"]!["status"]).toBe("active");
    expect(data["payments"]!["pay1"]!["status"]).toBe("completed");
  });
  it("is idempotent on retry, and a later webhook finds it already final", async () => {
    const { db, data } = fakeFirestore(seed());
    const args = { paymentId: "pay1", orderId: "order_1", providerPaymentId: "pay_x" };
    await completeVerifiedCheckout(db as never, args);
    expect(await completeVerifiedCheckout(db as never, args)).toBe("duplicate");
    const hook = await processProviderEvent(db as never, { eventType: "payment.captured", providerEventId: "evt_1", providerPaymentId: "pay_x", providerPaymentLinkId: null, providerRefundId: null, providerOrderId: "order_1", referenceId: "pay1", amount: 149900, currency: "INR" });
    expect(hook.outcome).toBe("already_final");
  });
});
