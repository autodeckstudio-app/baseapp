import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { knownClaimPaymentIds: string[]; truthOnly?: boolean }[] = [];
vi.mock("firebase/functions", () => ({
  httpsCallable: () => async (data: { knownClaimPaymentIds: string[]; truthOnly?: boolean }) => {
    calls.push(data);
    return {
      data: {
        // A truth-only call performs no scan; it must never supply scan fields
        // to the merged result. The mock returns DISTINCT nonempty pages and
        // junk scan fields on later calls so discarding them is observable.
        requests: [], reviewPayments: [],
        legacyClaims: data.truthOnly ? [{ paymentId: "MUST-BE-DISCARDED", claimedAt: null, reconcileState: null, reconcileNote: null, paymentStatus: null, amount: null, currency: null }] : [],
        legacyScanComplete: data.truthOnly ? false : true,
        claimTruth: data.knownClaimPaymentIds.map((paymentId) => ({ paymentId, state: data.truthOnly ? "resolved" : "held", note: null })),
      },
    };
  },
}));
vi.mock("./firebase", () => ({ functions: {} }));

import { listRefundWork } from "./refund-work-service";

describe("listRefundWork client batching", () => {
  beforeEach(() => { calls.length = 0; });

  it("batches >200 known ids so every shown row is refreshed", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `pay-${i}`);
    const work = await listRefundWork(ids);
    expect(calls.length).toBe(3);
    expect(calls[0]!.knownClaimPaymentIds).toHaveLength(200);
    expect(calls[1]!.knownClaimPaymentIds).toHaveLength(200);
    expect(calls[2]!.knownClaimPaymentIds).toHaveLength(50);
    expect(work.claimTruth).toHaveLength(450);
    // Only the first call runs the scan; later chunks are truth-only so the
    // paged cursors never advance past records nobody received, and their
    // discarded scan fields never leak into the merged result.
    expect(calls[0]!.truthOnly).toBeUndefined();
    expect(calls[1]!.truthOnly).toBe(true);
    expect(calls[2]!.truthOnly).toBe(true);
    expect(work.legacyScanComplete).toBe(true);
    expect(work.legacyClaims).toHaveLength(0);
    expect(work.claimTruth.filter((c) => c.state === "resolved")).toHaveLength(250);
    expect(work.claimTruth.filter((c) => c.state === "held")).toHaveLength(200);
  });

  it("single call when within the bound", async () => {
    await listRefundWork(["a", "b"]);
    expect(calls.length).toBe(1);
  });
});
