// useAuth client-order: a claims-read failure reaches a TERMINAL state
// (never an infinite loading screen), a resolver throw still ends ready,
// and a superseded async resolution never overwrites a newer principal.
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { create, act } from "react-test-renderer";
import React, { createElement } from "react";

const h = vi.hoisted(() => ({
  cb: null as null | ((user: unknown) => Promise<void>),
  resolve: vi.fn(),
  unsub: vi.fn(),
}));

vi.mock("../lib/auth-service", () => ({
  onIdTokenChanged: (cb: (user: unknown) => Promise<void>) => { h.cb = cb; return h.unsub; },
  resolveMyCustomerDocId: () => h.resolve(),
}));
vi.mock("../lib/price-cache", () => ({ priceCache: { setScope: () => {} } }));

import { useAuth } from "./useAuth";

function Probe({ onState }: { onState: (s: unknown) => void }) {
  const s = useAuth();
  onState(s);
  return null;
}

const userA = { uid: "uid-A", getIdTokenResult: async () => ({ claims: { role: "customer", tenantId: "automodz" } }) };
const userB = { uid: "uid-B", getIdTokenResult: async () => ({ claims: { role: "customer", tenantId: "automodz" } }) };

let last: { status: string; [k: string]: unknown };
let renderer: ReturnType<typeof create>;
async function mount() {
  await act(async () => { renderer = create(createElement(Probe, { onState: (s) => { last = s as typeof last; } })); });
}
afterEach(async () => {
  try { await act(async () => { renderer?.unmount(); }); } catch { /* already gone */ }
});
async function fire(user: unknown) { await act(async () => { await h.cb!(user); }); }

beforeEach(() => { h.cb = null; h.resolve.mockReset(); h.unsub.mockReset(); last = { status: "init" }; });

describe("useAuth terminal + stale-async behavior", () => {
  it("claims read failure lands terminal unauthenticated, not a hang", async () => {
    await mount();
    await fire({ uid: "uid-X", getIdTokenResult: async () => { throw new Error("network"); } });
    expect(last.status).toBe("unauthenticated");
  });

  it("resolver throw still ends ready with null customerDocId", async () => {
    h.resolve.mockRejectedValue(new Error("boom"));
    await mount();
    await fire(userA);
    expect(last.status).toBe("ready");
    expect((last as { customerDocId?: unknown }).customerDocId).toBeNull();
  });

  it("normal resolution: ready carries the canonical id", async () => {
    h.resolve.mockResolvedValue("staged-9");
    await mount();
    await fire(userA);
    expect(last.status).toBe("ready");
    expect((last as { customerDocId?: unknown }).customerDocId).toBe("staged-9");
  });

  it("a superseded resolution never overwrites the newer principal", async () => {
    let resolveA!: (v: string) => void;
    h.resolve
      .mockImplementationOnce(() => new Promise<string>((r) => { resolveA = r; })) // A: slow
      .mockResolvedValueOnce("id-B"); // B: fast
    await mount();
    const pA = h.cb!(userA); // in flight, not awaited, no act wrapper
    await act(async () => { await Promise.resolve(); }); // let A reach its pending resolve
    await act(async () => { await h.cb!(userB); });
    expect((last as unknown as { user: { uid: string } }).user.uid).toBe("uid-B");
    resolveA("id-A-STALE");
    await act(async () => { await pA.catch(() => {}); });
    expect((last as unknown as { user: { uid: string } }).user.uid).toBe("uid-B");
    expect((last as { customerDocId?: unknown }).customerDocId).toBe("id-B");
  });

  it("sign-out during resolution never lands ready for the old account", async () => {
    let resolveA!: (v: string) => void;
    h.resolve.mockImplementationOnce(() => new Promise<string>((r) => { resolveA = r; }));
    await mount();
    const pA = h.cb!(userA); // in flight, not awaited
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await h.cb!(null); });
    expect(last.status).toBe("unauthenticated");
    resolveA("id-A-STALE");
    await act(async () => { await pA.catch(() => {}); });
    expect(last.status).toBe("unauthenticated");
  });
});

describe("useAuth unmount", () => {
  it("a resolution still in flight at unmount never lands", async () => {
    let resolveA!: (v: string) => void;
    h.resolve.mockImplementationOnce(() => new Promise<string>((r) => { resolveA = r; }));
    await mount();
    const pA = h.cb!(userA);
    await act(async () => { await Promise.resolve(); });
    expect(h.unsub).not.toHaveBeenCalled();
    await act(async () => { renderer.unmount(); }); // act flushes the deferred effect cleanup
    expect(h.unsub).toHaveBeenCalledTimes(1); // effect cleanup ran: unsubscribe + generation bump
    resolveA("id-A-LATE");
    await act(async () => { await pA.catch(() => {}); }); // must not reject
    expect(last.status).toBe("loading"); // never overwritten after unmount
  });
});
