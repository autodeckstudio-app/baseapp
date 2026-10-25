import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { knownClaimPaymentIds: string[] }[] = [];
vi.mock("firebase/functions", () => ({
  httpsCallable: () => async (data: { knownClaimPaymentIds: string[] }) => {
    calls.push(data);
    return {
      data: {
        requests: [], reviewPayments: [], legacyClaims: [], legacyScanComplete: true,
        claimTruth: data.knownClaimPaymentIds.map((paymentId) => ({ paymentId, state: "held", note: null })),
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
    expect(work.legacyScanComplete).toBe(true);
  });

  it("single call when within the bound", async () => {
    await listRefundWork(["a", "b"]);
    expect(calls.length).toBe(1);
  });
});
