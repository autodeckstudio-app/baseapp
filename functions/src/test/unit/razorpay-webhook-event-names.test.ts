import { describe, it, expect } from "vitest";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";

// FIXTURE shaped after Razorpay's documented payloads (not captured live):
// https://razorpay.com/docs/webhooks/payment-links , https://razorpay.com/docs/webhooks/payments
// This pins what parseWebhookEvent does with documented names. It does not change mapping.
const p = new RazorpayProvider("k", "s", "w");
const link = { id: "plink_X", amount: 1000, reference_id: "ref1", status: "paid" };
const pay = { id: "pay_X", amount: 1000, currency: "INR", captured: true, order_id: "order_X" };

describe("parseWebhookEvent with documented Razorpay event names", () => {
  it("passes the documented event name through unchanged (no renaming)", () => {
    for (const ev of ["payment_link.paid", "payment_link.expired", "payment_link.cancelled", "payment.failed", "payment.captured"]) {
      expect(p.parseWebhookEvent(JSON.stringify({ event: ev, payload: { payment_link: { entity: link } } })).eventType).toBe(ev);
    }
  });
  it("documented payment_link.paid is NOT the handler's payment.link.paid name", () => {
    const e = p.parseWebhookEvent(JSON.stringify({ event: "payment_link.paid", payload: { payment_link: { entity: link }, payment: { entity: pay } } }));
    expect(e.eventType).not.toBe("payment.link.paid");
    expect(e.providerPaymentId).toBe("pay_X");
    expect(e.providerPaymentLinkId).toBe("plink_X");
  });
  it("expired and cancelled link events carry the link id and reference but no payment id", () => {
    const e = p.parseWebhookEvent(JSON.stringify({ event: "payment_link.expired", payload: { payment_link: { entity: { ...link, status: "expired", amount_paid: 0 } } } }));
    expect(e).toMatchObject({ providerPaymentLinkId: "plink_X", referenceId: "ref1", providerPaymentId: "" });
  });
});
