import { describe, it, expect } from "vitest";
import { runRefundAction } from "./refund-work-actions";

function rig() {
  let generation = 0;
  const calls: { busy: boolean[]; messages: (string | null)[]; refreshes: number } = { busy: [], messages: [], refreshes: 0 };
  const cycle = {
    generation: () => generation,
    refresh: () => { calls.refreshes += 1; return Promise.resolve(); },
  };
  const sink = {
    setBusy: (b: boolean) => { calls.busy.push(b); },
    setMessage: (m: string | null) => { calls.messages.push(m); },
  };
  return {
    cycle, sink, calls,
    bump: () => { generation += 1; },
  };
}

describe("runRefundAction identity binding", () => {
  it("success lands message, releases spinner and refreshes while identity is unchanged", async () => {
    const { cycle, sink, calls } = rig();
    let resolveAction!: (v: { n: number }) => void;
    const action = () => new Promise<{ n: number }>((res) => { resolveAction = res; });
    const p = runRefundAction(cycle, action, (r) => `done ${r.n}`, "failed", sink);
    resolveAction({ n: 3 });
    await p;
    expect(calls.messages).toEqual([null, "done 3"]);
    expect(calls.busy).toEqual([true, false]);
    expect(calls.refreshes).toBe(1);
  });

  it("a deferred SUCCESS after logout is a complete no-op: no message, no spinner release, no refresh", async () => {
    const { cycle, sink, calls, bump } = rig();
    let resolveAction!: (v: string) => void;
    const action = () => new Promise<string>((res) => { resolveAction = res; });
    const p = runRefundAction(cycle, action, () => "late success", "failed", sink);
    bump(); // identity changes (logout/tenant switch) mid-flight
    resolveAction("ok");
    await p;
    expect(calls.messages).toEqual([null]); // only the initial clear
    expect(calls.busy).toEqual([true]); // spinner never released by the stale action
    expect(calls.refreshes).toBe(0); // no list call the new identity never asked for
  });

  it("a deferred ERROR after tenant switch never surfaces and finally stays silent", async () => {
    const { cycle, sink, calls, bump } = rig();
    let rejectAction!: (e: Error) => void;
    const action = () => new Promise<string>((_res, rej) => { rejectAction = rej; });
    const p = runRefundAction(cycle, action, () => "ok", "failed", sink);
    bump();
    rejectAction(new Error("old tenant backend down"));
    await p;
    expect(calls.messages).toEqual([null]);
    expect(calls.busy).toEqual([true]);
    expect(calls.refreshes).toBe(0);
  });

  it("an action started by the NEW identity is unaffected by the old one's invalidation", async () => {
    const { cycle, sink, calls, bump } = rig();
    let resolveOld!: (v: string) => void;
    const oldAction = () => new Promise<string>((res) => { resolveOld = res; });
    const pOld = runRefundAction(cycle, oldAction, () => "old", "failed", sink);
    bump();
    // new identity's own action runs fully
    const pNew = runRefundAction(cycle, () => Promise.resolve("x"), () => "new landed", "failed", sink);
    resolveOld("late");
    await Promise.all([pOld, pNew]);
    expect(calls.messages).toEqual([null, null, "new landed"]);
    expect(calls.busy).toEqual([true, true, false]);
    expect(calls.refreshes).toBe(1); // only the new identity's refresh
  });
});
