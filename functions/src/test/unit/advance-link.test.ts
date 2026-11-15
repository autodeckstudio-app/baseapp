import { describe, it, expect } from "vitest";
import { ensureAdvanceLink, type AdvanceLinkDeps, type AdvanceLinkState, type FetchedLink } from "../../lib/advance-link.js";

const base: AdvanceLinkState = {
  id: "pay-1", amount: 23600, currency: "INR",
  paymentUrl: null, razorpayPaymentLinkId: null, razorpayOrderId: null, orderAmbiguous: null,
};
const params = { bookingId: "b-1", referenceId: "advance-b-1", description: "d", customerName: "n", customerPhone: "" };
const fetched = (over: Partial<FetchedLink> = {}): FetchedLink =>
  ({ id: "plink_1", amount: 23600, currency: "INR", paymentUrl: "https://pay/1", status: "created", ...over });

function deps(over: Partial<AdvanceLinkDeps> = {}) {
  const calls = { create: 0, fetch: 0, patch: 0, ambiguous: 0, claim: 0, cancel: [] as string[], review: [] as string[], patches: [] as unknown[] };
  const d: AdvanceLinkDeps = {
    createLink: async () => { calls.create++; return { providerPaymentLinkId: "plink_new", providerOrderId: "order_new", paymentUrl: "https://pay/new" }; },
    fetchLink: async () => { calls.fetch++; return fetched(); },
    claimCreate: async () => { calls.claim++; return { kind: "acquired" as const }; },
    patch: async (pt) => { calls.patch++; calls.patches.push(pt); return { bound: true as const }; },
    cancelLink: async (id) => { calls.cancel.push(id); return { outcome: "cancelled" }; },
    markAmbiguous: async () => { calls.ambiguous++; },
    flagManualReview: async (r) => { calls.review.push(r); },
    ...over,
  };
  return { d, calls };
}

describe("ensureAdvanceLink (reviewer: reconcile-first, never a blind payable URL or duplicate)", () => {
  it("no link id: creates once and returns the URL", async () => {
    const { d, calls } = deps();
    const r = await ensureAdvanceLink(base, params, d);
    expect(r).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/new" });
    expect(calls.create).toBe(1); expect(calls.fetch).toBe(0);
  });

  it("stored URL + provider says ACTIVE: returns it - but only AFTER validating with the provider", async () => {
    const { d, calls } = deps();
    const r = await ensureAdvanceLink({ ...base, paymentUrl: "https://pay/1", razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/1" });
    expect(calls.fetch).toBe(1); // reconcile-first: NO blind stored-URL return
    expect(calls.create).toBe(0); expect(calls.patch).toBe(0);
  });

  it("stored URL + provider says EXPIRED (webhook delayed/missing): fresh create, never the dead URL", async () => {
    const { d, calls } = deps({ fetchLink: async () => { calls.fetch++; return fetched({ status: "expired" }); } });
    const r = await ensureAdvanceLink({ ...base, paymentUrl: "https://pay/1", razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/new" });
    expect(calls.create).toBe(1);
  });

  it("stored URL + provider-side CANCEL: fresh create (old confirmed inactive)", async () => {
    const { d, calls } = deps({ fetchLink: async () => { calls.fetch++; return fetched({ status: "cancelled" }); } });
    const r = await ensureAdvanceLink({ ...base, paymentUrl: "https://pay/1", razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r.outcome).toBe("link_ready"); expect(calls.create).toBe(1);
  });

  it("stored URL + provider says PAID: manual review, never hand out, never create", async () => {
    const { d, calls } = deps({ fetchLink: async () => { calls.fetch++; return fetched({ status: "paid" }); } });
    const r = await ensureAdvanceLink({ ...base, paymentUrl: "https://pay/1", razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r.outcome).toBe("manual_review");
    expect(calls.create).toBe(0); expect(calls.review.length).toBe(1);
  });

  it("stored URL + provider says PARTIALLY_PAID: manual review (money attached), never hand out", async () => {
    const { d, calls } = deps({ fetchLink: async () => { calls.fetch++; return fetched({ status: "partially_paid" }); } });
    const r = await ensureAdvanceLink({ ...base, paymentUrl: "https://pay/1", razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r.outcome).toBe("manual_review"); expect(calls.create).toBe(0);
  });

  it("stored URL + UNKNOWN provider status: fails closed to manual review", async () => {
    const { d, calls } = deps({ fetchLink: async () => { calls.fetch++; return fetched({ status: "something_new" }); } });
    const r = await ensureAdvanceLink({ ...base, paymentUrl: "https://pay/1", razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r.outcome).toBe("manual_review"); expect(calls.create).toBe(0);
  });

  it("provider UNREACHABLE while validating: throws try-again, stays closed, no create", async () => {
    const { d, calls } = deps({ fetchLink: async () => { calls.fetch++; throw new Error("network"); } });
    await expect(ensureAdvanceLink({ ...base, paymentUrl: "https://pay/1", razorpayPaymentLinkId: "plink_1" }, params, d)).rejects.toThrow(/try again/);
    expect(calls.create).toBe(0);
  });

  it("active link with a mismatched amount goes to manual review, not to the customer", async () => {
    const { d, calls } = deps({ fetchLink: async () => { calls.fetch++; return fetched({ amount: 99999 }); } });
    const r = await ensureAdvanceLink({ ...base, paymentUrl: "https://pay/1", razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r.outcome).toBe("manual_review"); expect(calls.review.length).toBe(1);
  });

  it("cleared URL (webhook cleared) + provider says old link EXPIRED: a fresh link is created (old confirmed inactive)", async () => {
    const { d, calls } = deps({ fetchLink: async () => { calls.fetch++; return fetched({ status: "expired", paymentUrl: "https://pay/old" }); } });
    const r = await ensureAdvanceLink({ ...base, razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/new" });
    expect(calls.fetch).toBe(1); expect(calls.create).toBe(1);
  });

  it("cleared URL + provider says still ACTIVE: re-stores the URL, never creates", async () => {
    const { d, calls } = deps();
    const r = await ensureAdvanceLink({ ...base, razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/1" });
    expect(calls.create).toBe(0); expect(calls.patch).toBe(1);
  });

  it("replacement create carries the superseded link+order ids for append-only history (G2)", async () => {
    const { d, calls } = deps({ fetchLink: async () => { calls.fetch++; return fetched({ status: "expired" }); } });
    await ensureAdvanceLink({ ...base, razorpayPaymentLinkId: "plink_1", razorpayOrderId: "order_1" }, params, d);
    const last = calls.patches[calls.patches.length - 1] as { superseded?: { linkId: string | null; orderId: string | null } };
    expect(last.superseded).toEqual({ linkId: "plink_1", orderId: "order_1" });
  });

  it("ambiguous + referenced link ACTIVE and matching: reconciles, patches, clears ambiguity, no create", async () => {
    const { d, calls } = deps();
    const r = await ensureAdvanceLink({ ...base, orderAmbiguous: true, razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/1" });
    expect(calls.create).toBe(0); expect(calls.patch).toBe(1); expect(calls.ambiguous).toBe(1);
  });

  it("ambiguous + referenced link INACTIVE: manual review (a lost create may exist provider-side), never blind-create", async () => {
    const { d, calls } = deps({ fetchLink: async () => { calls.fetch++; return fetched({ status: "expired" }); } });
    const r = await ensureAdvanceLink({ ...base, orderAmbiguous: true, razorpayPaymentLinkId: "plink_1" }, params, d);
    expect(r.outcome).toBe("manual_review"); expect(calls.create).toBe(0);
  });

  it("ambiguous + NO reference at all: manual review, NEVER a second blind link", async () => {
    const { d, calls } = deps();
    const r = await ensureAdvanceLink({ ...base, orderAmbiguous: true }, params, d);
    expect(r.outcome).toBe("manual_review");
    expect(calls.create).toBe(0); // the blind-retry guard
  });

  it("create threw -> marked ambiguous; the retry then reconciles instead of re-creating", async () => {
    const { d, calls } = deps({ createLink: async () => { calls.create++; throw new Error("provider timeout"); } });
    await expect(ensureAdvanceLink(base, params, d)).rejects.toThrow(/timeout/);
    expect(calls.ambiguous).toBe(1);
  });

  it("provider succeeded but the DB patch failed -> ambiguous WITH reference; next retry reconciles via fetch, no second create", async () => {
    let patchFails = true;
    const { d, calls } = deps({
      patch: async () => { calls.patch++; if (patchFails) { patchFails = false; throw new Error("db down"); } return { bound: true as const }; },
    });
    await expect(ensureAdvanceLink(base, params, d)).rejects.toThrow(/db down/);
    expect(calls.ambiguous).toBe(1);
    // retry: ambiguous + link id -> fetch (mock now finds the NEW link active)
    const { d: d2, calls: c2 } = deps({ fetchLink: async () => { c2.fetch++; return fetched({ id: "plink_new", paymentUrl: "https://pay/new" }); } });
    const r2 = await ensureAdvanceLink({ ...base, orderAmbiguous: true, razorpayPaymentLinkId: "plink_new" }, params, d2);
    expect(r2).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/new" });
    expect(c2.create).toBe(0);
  });
});

describe("R1: concurrent double create - exclusive lease, conflict cancel, never an unbound payable loser", () => {
  it("double tap: the second caller sees the lease HELD (not ambiguous) and gets a retryable error - only ONE provider create", async () => {
    const { d, calls } = deps({ claimCreate: async () => { calls.claim++; return { kind: "held" as const, ambiguous: false }; } });
    await expect(ensureAdvanceLink(base, params, d)).rejects.toThrow(/confirming your earlier payment link/);
    expect(calls.create).toBe(0); expect(calls.review.length).toBe(0);
  });

  it("crash mid-create (lease held, ambiguity stuck): next caller fails CLOSED to manual review, never blind-creates", async () => {
    const { d, calls } = deps({ claimCreate: async () => { calls.claim++; return { kind: "held" as const, ambiguous: true }; } });
    const r = await ensureAdvanceLink(base, params, d);
    expect(r.outcome).toBe("manual_review");
    expect(calls.create).toBe(0); expect(calls.review[0]).toMatch(/interrupted/);
  });

  it("lost race: winner bound first - loser ids bound to history, loser cancelled at the provider, winner URL returned after provider validation", async () => {
    const { d, calls } = deps({
      patch: async () => { calls.patch++; return { bound: false as const, winnerLinkId: "plink_win" }; },
      fetchLink: async (id) => { calls.fetch++; return fetched({ id, paymentUrl: "https://pay/win" }); },
    });
    const r = await ensureAdvanceLink(base, params, d);
    expect(r).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/win" });
    expect(calls.cancel).toEqual(["plink_new"]); // the loser, never left payable
    expect(calls.review.length).toBe(0);
  });

  it("lost race + provider cancel fails: actionable ops retry via manual review, no URL handed out", async () => {
    const { d, calls } = deps({
      patch: async () => { calls.patch++; return { bound: false as const, winnerLinkId: "plink_win" }; },
      cancelLink: async () => { calls.cancel.push("x"); throw new Error("provider timeout"); },
    });
    const r = await ensureAdvanceLink(base, params, d);
    expect(r.outcome).toBe("manual_review");
    expect(calls.review[0]).toMatch(/cancel_failed/);
  });

  it("lost race + cancel says money attached: manual review (double money), no URL", async () => {
    const { d, calls } = deps({
      patch: async () => { calls.patch++; return { bound: false as const, winnerLinkId: "plink_win" }; },
      cancelLink: async () => { calls.cancel.push("x"); return { outcome: "already_paid" }; },
    });
    const r = await ensureAdvanceLink(base, params, d);
    expect(r.outcome).toBe("manual_review");
    expect(calls.review[0]).toMatch(/already_paid/);
  });

  it("a DIFFERENT link bound before our claim: reconcile the winner provider-first instead of creating", async () => {
    const { d, calls } = deps({
      claimCreate: async () => { calls.claim++; return { kind: "linked" as const, linkId: "plink_win" }; },
      fetchLink: async (id) => { calls.fetch++; return fetched({ id, paymentUrl: "https://pay/win" }); },
    });
    const r = await ensureAdvanceLink(base, params, d);
    expect(r).toEqual({ outcome: "link_ready", paymentUrl: "https://pay/win" });
    expect(calls.create).toBe(0); expect(calls.fetch).toBe(1);
  });
});
