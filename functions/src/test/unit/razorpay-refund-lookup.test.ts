// TEST. The Razorpay refund-reference lookup reconciles ambiguous submits but
// may NEVER claim authoritative absence: a miss or a failed list call is
// always "unknown", so a held reservation stays held for manual reconciliation.
import { describe, expect, it, vi, afterEach } from "vitest";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";

const provider = new RazorpayProvider("key_id", "key_secret", "webhook_secret");

function stubFetch(impl: (url: string) => { ok: boolean; body: unknown }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const { ok, body } = impl(String(input));
    return new Response(JSON.stringify(body), { status: ok ? 200 : 500 });
  });
}

afterEach(() => vi.restoreAllMocks());

describe("RazorpayProvider.findRefundByReference", () => {
  it("found: a refund whose receipt is our reference projects its provider id", async () => {
    stubFetch(() => ({
      ok: true,
      body: { items: [{ id: "rfnd_1", receipt: "other" }, { id: "rfnd_2", receipt: "req-123" }] },
    }));
    await expect(provider.findRefundByReference("req-123")).resolves.toEqual({
      outcome: "found",
      providerRefundId: "rfnd_2",
    });
  });
  it("miss: not on the fetched page is unknown, NEVER absent_confirmed", async () => {
    stubFetch(() => ({ ok: true, body: { items: [{ id: "rfnd_1", receipt: "other" }] } }));
    await expect(provider.findRefundByReference("req-123")).resolves.toEqual({ outcome: "unknown" });
  });
  it("list failure is unknown (inconclusive), never a release signal", async () => {
    stubFetch(() => ({ ok: false, body: {} }));
    await expect(provider.findRefundByReference("req-123")).resolves.toEqual({ outcome: "unknown" });
  });
  it("receipt-bearing refunds are what initiateRefund submits (receipt = referenceId)", async () => {
    const spy = stubFetch(() => ({ ok: true, body: { id: "rfnd_9" } }));
    await provider.initiateRefund({ providerPaymentId: "pay_1", amount: 100, reason: "cancel", referenceId: "req-123" });
    const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(body.receipt).toBe("req-123");
  });
});
