import { describe, it, expect, vi } from "vitest";
import type { Payment } from "@autodeck/core";
import type { PaymentProvider } from "../../lib/payment-provider.js";
import { obtainGiftPaymentLink } from "../../lib/gift-payment-link.js";
import { fakeFirestore } from "./fake-firestore.js";
const payment = (extra = {}) => ({ id: "p", targetType: "gift", giftId: "g", customerId: "c", tenantId: "t", amount: 90000, currency: "INR", method: "razorpay_payment_link", status: "pending", razorpayPaymentLinkId: null, razorpayOrderId: null, ...extra }) as Payment;
const gift = { createdAt: new Date().toISOString(), id: "g", status: "PENDING_PAYMENT", buyerId: "c", tenantId: "t", amountPaise: 90000 };
const provider = () => ({ createPaymentLink: vi.fn(async () => ({ paymentUrl: "https://pay.example", providerPaymentLinkId: "link", providerOrderId: "order" })), fetchPaymentLink: vi.fn(async () => ({ providerPaymentLinkId: "link", amount: 90000, currency: "INR", paymentUrl: "https://pay.example", status: "created" })), cancelPaymentLink: vi.fn() });
describe("gift hosted link", () => {
  it("creates one bound link without granting a code/entitlement", async () => {
    const p = payment(), { db, data } = fakeFirestore({ payments: { p: { ...p } }, gifts: { g: gift } }); const api = provider();
    expect(await obtainGiftPaymentLink(db as never, p, api as unknown as PaymentProvider, "")).toEqual({ outcome: "link_ready", paymentUrl: "https://pay.example" });
    expect(api.createPaymentLink).toHaveBeenCalledTimes(1); expect(data.payments!.p!.razorpayPaymentLinkId).toBe("link"); expect(data.gifts!.g!.status).toBe("PENDING_PAYMENT");
  });
  it("replays only a provider-validated existing link", async () => {
    const p = payment({ razorpayPaymentLinkId: "link", razorpayOrderId: "order", paymentUrl: "https://stale.example" }); const { db } = fakeFirestore({ payments: { p: { ...p } }, gifts: { g: gift } }); const api = provider();
    expect(await obtainGiftPaymentLink(db as never, p, api as unknown as PaymentProvider, "")).toMatchObject({ paymentUrl: "https://pay.example" }); expect(api.createPaymentLink).not.toHaveBeenCalled();
  });
  it.each([{ status: "completed" }, { customerId: "other" }, { amount: 1 }, { linkCreateLeaseId: "gift-standard-checkout" }, { razorpayOrderId: "existing-web-order" }])("fails closed for changed/checkout-in-flight payment %j", async extra => {
    const p = payment(), { db } = fakeFirestore({ payments: { p: { ...p, ...extra } }, gifts: { g: gift } }); const api = provider();
    await expect(obtainGiftPaymentLink(db as never, p, api as unknown as PaymentProvider, "")).rejects.toThrow(); expect(api.createPaymentLink).not.toHaveBeenCalled();
  });
  it("does not pay a void gift", async () => {
    const p = payment(), { db } = fakeFirestore({ payments: { p: { ...p } }, gifts: { g: { ...gift, status: "VOID" } } }); const api = provider();
    await expect(obtainGiftPaymentLink(db as never, p, api as unknown as PaymentProvider, "")).rejects.toThrow(); expect(api.createPaymentLink).not.toHaveBeenCalled();
  });
  it("does not create after ambiguous response loss", async () => {
    const p = payment({ orderAmbiguous: true }), { db, data } = fakeFirestore({ payments: { p: { ...p } }, gifts: { g: gift } }); const api = provider();
    expect(await obtainGiftPaymentLink(db as never, p, api as unknown as PaymentProvider, "")).toEqual({ outcome: "manual_review" }); expect(api.createPaymentLink).not.toHaveBeenCalled(); expect(data.staffAlerts).toBeDefined();
  });
});

it.each(["paid", "partially_paid", "unknown"])("gift provider %s never returns a payable URL", async status => {
  const p = payment({ razorpayPaymentLinkId: "link", razorpayOrderId: "order" }), { db } = fakeFirestore({ payments: { p: { ...p } }, gifts: { g: gift } }); const api = provider();
  api.fetchPaymentLink.mockResolvedValueOnce({ providerPaymentLinkId: "link", amount: 90000, currency: "INR", paymentUrl: "https://pay.example", status });
  expect(await obtainGiftPaymentLink(db as never, p, api as unknown as PaymentProvider, "")).toEqual({ outcome: "manual_review" }); expect(api.createPaymentLink).not.toHaveBeenCalled();
});
it("expired unpaid gift cannot start a link", async () => {
  const p = payment(), { db } = fakeFirestore({ payments: { p: { ...p } }, gifts: { g: { ...gift, createdAt: "2020-01-01T00:00:00Z" } } }); const api = provider();
  await expect(obtainGiftPaymentLink(db as never, p, api as unknown as PaymentProvider, "")).rejects.toThrow(); expect(api.createPaymentLink).not.toHaveBeenCalled();
});
