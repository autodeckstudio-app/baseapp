// TEST. The Razorpay refund lookup reconciles ambiguous submits with BOUND
// identity: scoped to our stored provider payment id, and the refund must
// agree on receipt + amount + currency. It may NEVER claim authoritative
// absence: a miss, a partial match, duplicates, or a failed list call is
// always "unknown", so a held reservation stays held for manual reconciliation.
import { describe, expect, it, vi, afterEach } from "vitest";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";
import type { RefundBinding } from "../../lib/payment-provider.js";

const provider = new RazorpayProvider("key_id", "key_secret", "webhook_secret");
const BINDING: RefundBinding = { providerPaymentId: "pay_1", amountPaise: 50000, currency: "INR" };

function stubFetch(impl: (url: string) => { ok: boolean; body: unknown }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const { ok, body } = impl(String(input));
    return new Response(JSON.stringify(body), { status: ok ? 200 : 500 });
  });
}

afterEach(() => vi.restoreAllMocks());

describe("RazorpayProvider.findRefundByReference (bound)", () => {
  it("scopes the query to OUR payment, not the account-wide list", async () => {
    const spy = stubFetch(() => ({ ok: true, body: { items: [] } }));
    await provider.findRefundByReference("req-123", BINDING);
    expect(String(spy.mock.calls[0]?.[0])).toBe("https://api.razorpay.com/v1/payments/pay_1/refunds?count=100");
  });
  it("found: receipt + amount + currency all agree on our payment", async () => {
    stubFetch(() => ({
      ok: true,
      body: { items: [
        { id: "rfnd_1", receipt: "other", amount: 50000, currency: "INR" },
        { id: "rfnd_2", receipt: "req-123", amount: 50000, currency: "INR" },
      ] },
    }));
    await expect(provider.findRefundByReference("req-123", BINDING)).resolves.toEqual({
      outcome: "found",
      providerRefundId: "rfnd_2",
    });
  });
  it("receipt match with a DIFFERENT amount is unknown, never attached", async () => {
    stubFetch(() => ({
      ok: true,
      body: { items: [{ id: "rfnd_1", receipt: "req-123", amount: 99900, currency: "INR" }] },
    }));
    const r = await provider.findRefundByReference("req-123", BINDING);
    expect(r).toEqual({ outcome: "unknown" });
    expect(JSON.stringify(r)).not.toContain("rfnd_");
  });
  it("receipt+amount match with a DIFFERENT currency is unknown, never attached", async () => {
    stubFetch(() => ({
      ok: true,
      body: { items: [{ id: "rfnd_1", receipt: "req-123", amount: 50000, currency: "USD" }] },
    }));
    const r = await provider.findRefundByReference("req-123", BINDING);
    expect(r).toEqual({ outcome: "unknown" });
    expect(JSON.stringify(r)).not.toContain("rfnd_");
  });
  it("one bound match plus one partial (amount mismatch) is ambiguous unknown - the partial poisons the pick", async () => {
    stubFetch(() => ({
      ok: true,
      body: { items: [
        { id: "rfnd_1", receipt: "req-123", amount: 50000, currency: "INR" },
        { id: "rfnd_2", receipt: "req-123", amount: 100, currency: "INR" },
      ] },
    }));
    const r = await provider.findRefundByReference("req-123", BINDING);
    expect(r).toEqual({ outcome: "unknown" });
    expect(JSON.stringify(r)).not.toContain("rfnd_");
  });
  it("miss: not on the fetched page is unknown, NEVER absent_confirmed", async () => {
    stubFetch(() => ({ ok: true, body: { items: [{ id: "rfnd_1", receipt: "other", amount: 50000, currency: "INR" }] } }));
    await expect(provider.findRefundByReference("req-123", BINDING)).resolves.toEqual({ outcome: "unknown" });
  });
  it("list failure is unknown (inconclusive), never a release signal", async () => {
    stubFetch(() => ({ ok: false, body: {} }));
    await expect(provider.findRefundByReference("req-123", BINDING)).resolves.toEqual({ outcome: "unknown" });
  });
  it("transport rejection is unknown, never a thrown error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(provider.findRefundByReference("req-123", BINDING)).resolves.toEqual({ outcome: "unknown" });
  });
  it("malformed JSON body is unknown, never a thrown parse error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not-json{", { status: 200 }));
    await expect(provider.findRefundByReference("req-123", BINDING)).resolves.toEqual({ outcome: "unknown" });
  });
  it("duplicate fully-bound matches are ambiguous unknown - NEVER an arbitrary first pick", async () => {
    stubFetch(() => ({
      ok: true,
      body: { items: [
        { id: "rfnd_1", receipt: "req-123", amount: 50000, currency: "INR" },
        { id: "rfnd_2", receipt: "req-123", amount: 50000, currency: "INR" },
      ] },
    }));
    const r = await provider.findRefundByReference("req-123", BINDING);
    expect(r).toEqual({ outcome: "unknown" });
    expect(JSON.stringify(r)).not.toContain("rfnd_");
  });
  it("receipt-bearing refunds are what initiateRefund submits (receipt = referenceId)", async () => {
    const spy = stubFetch(() => ({ ok: true, body: { id: "rfnd_9" } }));
    await provider.initiateRefund({ providerPaymentId: "pay_1", amount: 100, reason: "cancel", referenceId: "req-123" });
    const body = JSON.parse(String(spy.mock.calls[0]?.[1]?.body));
    expect(body.receipt).toBe("req-123");
  });
});
