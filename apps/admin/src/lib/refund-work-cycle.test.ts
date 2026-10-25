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
    await flush();
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
    await flush();
    cycle.reset(true); // switch to tenant B
    await flush();
    expect(pending).toHaveLength(1); // B's call queued behind A's (serialized)
    pending[0]!.reject(new Error("old tenant backend down"));
    await flush();
    expect(cycle.getState().error).toBeNull();
    expect(pending).toHaveLength(2); // B's own scan now starts
    pending[1]!.resolve(work({ legacyClaims: [claim("pay-b")] }));
    await flush();
    expect([...cycle.getState().accum.keys()]).toEqual(["pay-b"]);
    expect(cycle.getState().loading).toBe(false);
  });

  it("a delayed old-tenant success cannot move the new identity's spinner or overwrite its rows", async () => {
    const { list, pending } = deferredList();
    const cycle = createRefundWorkCycle(list);
    cycle.reset(true); // A
    await flush();
    cycle.reset(true); // B -> B's scan queued
    await flush();
    pending[0]!.resolve(work({ legacyClaims: [claim("pay-a")] }));
    await flush();
    const s = cycle.getState();
    expect(s.accum.size).toBe(0);
    expect(s.loading).toBe(true); // B's own refresh now in flight
  });

  it("a fresh identity's first refresh sends an empty known-id set, never the previous cycle's rows", async () => {
    const { list, pending } = deferredList();
    const cycle = createRefundWorkCycle(list);
    cycle.reset(true);
    await flush();
    pending[0]!.resolve(work({ legacyClaims: [claim("pay-a1"), claim("pay-a2")] }));
    await flush();
    expect(cycle.getState().accum.size).toBe(2);
    cycle.reset(true); // tenant B
    await flush();
    expect(pending[1]!.ids).toEqual([]);
  });

  it("a refresh within one identity sends every shown row's id for truth refresh", async () => {
    const { list, pending } = deferredList();
    const cycle = createRefundWorkCycle(list);
    cycle.reset(true);
    await flush();
    pending[0]!.resolve(work({ legacyClaims: [claim("p1"), claim("p2")] }));
    await flush();
    void cycle.refresh();
    await flush();
    expect(pending[1]!.ids.sort()).toEqual(["p1", "p2"]);
  });
});

describe("serialized scan queue", () => {
  it("two competing refreshes consume DISTINCT backend pages and every consumed page lands", async () => {
    // Backend cursor: each call advances it and returns a distinct page,
    // exactly like listRefundWork's persisted reconcileFast_/reconcileDiscover_ cursors.
    const pages: RefundWork[] = [
      work({ legacyClaims: [claim("pg1-a"), claim("pg1-b")] }),
      work({ legacyClaims: [claim("pg2-a")] }),
    ];
    let cursor = 0;
    const calls: string[][] = [];
    const pending: ((w: RefundWork) => void)[] = [];
    const list = (ids: string[]) => new Promise<RefundWork>((res) => {
      calls.push(ids);
      const page = pages[cursor++] ?? work();
      pending.push(() => res(page));
    });
    const cycle = createRefundWorkCycle(list);
    cycle.reset(true); // consumes page 1
    void cycle.refresh(); // competing refresh while page-1 call is in flight
    await flush();
    expect(pending).toHaveLength(1); // serialized: second call not issued yet
    pending[0]!(); // page 1 lands
    await flush();
    expect(pending).toHaveLength(2); // now the queued call starts
    expect(calls[1]).toEqual(["pg1-a", "pg1-b"]); // and sends the UPDATED known ids
    pending[1]!(); // page 2 lands
    await flush();
    const keys = [...cycle.getState().accum.keys()].sort();
    expect(keys).toEqual(["pg1-a", "pg1-b", "pg2-a"]); // no consumed page is ever lost
    expect(cycle.getState().loading).toBe(false);
  });

  it("a queued refresh whose identity died before it started consumes nothing and applies nothing", async () => {
    const { list, pending } = deferredList();
    const cycle = createRefundWorkCycle(list);
    cycle.reset(true);
    await flush(); // gen1 login scan now in flight
    void cycle.refresh(); // queued behind it
    cycle.reset(true); // identity switch BEFORE the queued run starts
    await flush();
    expect(pending).toHaveLength(1); // gen1 login call only; gen1 queued run will skip
    pending[0]!.resolve(work({ legacyClaims: [claim("old-gen")] }));
    await flush();
    expect(pending).toHaveLength(2); // only the NEW identity's scan actually calls out
    const s = cycle.getState();
    expect(s.accum.size).toBe(0); // old generation contributed nothing
    expect(s.loading).toBe(true); // new identity's own scan owns the spinner
  });
});

describe("dispose", () => {
  it("invalidates pending work and silences listeners after unmount", async () => {
    const { list, pending } = deferredList();
    const cycle = createRefundWorkCycle(list);
    let ticks = 0;
    cycle.subscribe(() => { ticks += 1; });
    cycle.reset(true);
    await flush();
    expect(pending).toHaveLength(1);
    const before = ticks;
    cycle.dispose();
    pending[0]!.resolve(work({ legacyClaims: [claim("late")] }));
    await flush();
    const s = cycle.getState();
    expect(s.accum.size).toBe(0);
    expect(s.work).toBeNull();
    expect(s.loading).toBe(false);
    expect(ticks).toBe(before); // no notification after dispose
  });
});
