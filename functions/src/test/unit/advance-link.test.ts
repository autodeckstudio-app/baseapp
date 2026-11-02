import { describe, it, expect } from "vitest";
import { ensureAdvanceLink, type AdvanceLinkDeps, type AdvanceLinkState } from "../../lib/advance-link.js";

const base: AdvanceLinkState = {
  id: "pay-1", amount: 23600, currency: "INR",
  paymentUrl: null, razorpayPaymentLinkId: null, razorpayOrderId: null, orderAmbiguous: null,
};
const params = { bookingId: "b-1", referenceId: "advance-b-1", description: "d", customerName: "n" };

function deps(over: Partial<AdvanceLinkDeps> = {}) {
  const calls = { create: 0, fetch: 0, patch: 0, ambiguous: 0, review: [] as string[] };
  const d: AdvanceLinkDeps = {
    createLink: async () => { calls.create++; return { providerPaymentLinkId: "plink_1", providerOrderId: "order_1", paymentUrl: "https://pay/1" }; },
    fetchLink: async () => { calls.fetch++; return { id: "plink_1", amount: 23600, currency: "INR", paymentUrl: "https://pay/1" }; },
    patch: async () => { calls.patch++; },
    markAmbiguous: async () => { calls.ambiguous++; },
    flagManualReview: async (r) => { calls.review.push(r); },
    ...over,
  };
  return { d, calls };
}

describe("ensureAdvanceLink (reviewer A: never blind-retry a payable link)", () => {
  it("happy path creates once and returns the URL", async () => {
    const { d, calls } = deps();
    const r = await ensureAdvanceLink(base, params, d);
    expect(r).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/1" });
    expect(calls.create).toBe(1);
  });
  it("an already-linked record replays with NO provider call", async () => {
    const { d, calls } = deps();
    const r = await ensureAdvanceLink({ ...base, paymentUrl: "https://pay/1", razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r.outcome).toBe("link_ready");
    expect(calls.create).toBe(0); expect(calls.fetch).toBe(0);
  });
  it("create threw -> ambiguous; retry with NO reference goes to manual review and NEVER creates a second link", async () => {
    const { d, calls } = deps({ createLink: async () => { calls.create++; throw new Error("provider timeout"); } });
    await expect(ensureAdvanceLink(base, params, d)).rejects.toThrow(/timeout/);
    expect(calls.ambiguous).toBe(1);
    const { d: d2, calls: c2 } = deps();
    const r2 = await ensureAdvanceLink({ ...base, orderAmbiguous: true }, params, d2);
    expect(r2.outcome).toBe("manual_review");
    expect(c2.create).toBe(0); // the blind-retry guard
    expect(c2.review.length).toBe(1);
  });
  it("provider succeeded but the DB patch failed -> retry reconciles via fetch-by-id, no second create", async () => {
    const { d, calls } = deps();
    const r = await ensureAdvanceLink({ ...base, orderAmbiguous: true, razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/1" });
    expect(calls.fetch).toBe(1); expect(calls.create).toBe(0); expect(calls.patch).toBe(1);
  });
  it("reconciled link with a mismatched amount goes to manual review, not to the customer", async () => {
    const { d, calls } = deps({ fetchLink: async () => ({ id: "plink_1", amount: 99999, currency: "INR", paymentUrl: "https://pay/x" }) });
    const r = await ensureAdvanceLink({ ...base, orderAmbiguous: true, razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r.outcome).toBe("manual_review");
    expect(calls.review.length).toBe(1);
  });
});
