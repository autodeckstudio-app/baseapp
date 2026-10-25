import { describe, it, expect } from "vitest";
import { createRefundWorkCycle, mergeWorkIntoAccum } from "./refund-work-cycle";
import type { LegacyRefundClaim, RefundWork } from "./refund-work-service";

const claim = (paymentId: string, over: Partial<LegacyRefundClaim> = {}): LegacyRefundClaim => ({
  paymentId, claimedAt: "2026-10-25T00:00:00.000Z", reconcileState: "held", reconcileNote: null,
  paymentStatus: "completed", amount: 10000, currency: "INR", ...over,
});
const work = (over: Partial<RefundWork> = {}): RefundWork => ({
  requests: [], reviewPayments: [], legacyClaims: [], legacyScanComplete: true, claimTruth: [], ...over,
});
const flush = () => new Promise((r) => setTimeout(r, 0));

function deferredList() {
  const pending: { ids: string[]; resolve: (w: RefundWork) => void; reject: (e: Error) => void }[] = [];
  const list = (ids: string[]) => new Promise<RefundWork>((resolve, reject) => { pending.push({ ids, resolve, reject }); });
  return { list, pending };
}

describe("refund work identity cycle", () => {
  it("logout bumps the generation and clears; a delayed pre-logout response cannot repopulate rows, set an error, or move the spinner", async () => {
    const { list, pending } = deferredList();
    const cycle = createRefundWorkCycle(list);
    cycle.reset(true); // login
    expect(pending).toHaveLength(1);
    cycle.reset(false); // logout BEFORE the response arrives
    expect(cycle.getState().accum.size).toBe(0);
    expect(cycle.getState().loading).toBe(false);
    pending[0]!.resolve(work({ legacyClaims: [claim("pay-old-tenant")] }));
    await flush();
    const s = cycle.getState();
    expect(s.accum.size).toBe(0);
    expect(s.work).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it("a delayed old-tenant error does not surface after switching tenants, and the new tenant's rows land", async () => {
    const { list, pending } = deferredList();
    const cycle = createRefundWorkCycle(list);
    cycle.reset(true); // tenant A
    cycle.reset(true); // switch to tenant B
    expect(pending).toHaveLength(2);
    pending[0]!.reject(new Error("old tenant backend down"));
    await flush();
    expect(cycle.getState().error).toBeNull();
    pending[1]!.resolve(work({ legacyClaims: [claim("pay-b")] }));
    await flush();
    expect([...cycle.getState().accum.keys()]).toEqual(["pay-b"]);
    expect(cycle.getState().loading).toBe(false);
  });

  it("a delayed old-tenant success cannot move the new identity's spinner or overwrite its rows", async () => {
    const { list, pending } = deferredList();
    const cycle = createRefundWorkCycle(list);
    cycle.reset(true); // A
    cycle.reset(true); // B -> loading for B's scan
    pending[0]!.resolve(work({ legacyClaims: [claim("pay-a")] }));
    await flush();
    const s = cycle.getState();
    expect(s.accum.size).toBe(0);
    expect(s.loading).toBe(true); // B's own refresh still in flight
  });

  it("a fresh identity's first refresh sends an empty known-id set, never the previous cycle's rows", async () => {
    const { list, pending } = deferredList();
    const cycle = createRefundWorkCycle(list);
    cycle.reset(true);
    pending[0]!.resolve(work({ legacyClaims: [claim("pay-a1"), claim("pay-a2")] }));
    await flush();
    expect(cycle.getState().accum.size).toBe(2);
    cycle.reset(true); // tenant B
    expect(pending[1]!.ids).toEqual([]);
  });

  it("a refresh within one identity sends every shown row's id for truth refresh", async () => {
    const { list, pending } = deferredList();
    const cycle = createRefundWorkCycle(list);
    cycle.reset(true);
    pending[0]!.resolve(work({ legacyClaims: [claim("p1"), claim("p2")] }));
    await flush();
    void cycle.refresh();
    expect(pending[1]!.ids.sort()).toEqual(["p1", "p2"]);
  });
});

describe("mergeWorkIntoAccum", () => {
  it("pages accumulate, truth updates in place, resolved/released drop as truth", () => {
    let acc: Map<string, LegacyRefundClaim> = new Map();
    acc = mergeWorkIntoAccum(acc, work({ legacyClaims: [claim("p1"), claim("p2")] }));
    acc = mergeWorkIntoAccum(acc, work({
      legacyClaims: [claim("p3")],
      claimTruth: [
        { paymentId: "p1", state: "resolved", note: null },
        { paymentId: "p2", state: "held", note: "provider pending" },
      ],
    }));
    expect([...acc.keys()].sort()).toEqual(["p2", "p3"]);
    expect(acc.get("p2")!.reconcileNote).toBe("provider pending");
  });
});
