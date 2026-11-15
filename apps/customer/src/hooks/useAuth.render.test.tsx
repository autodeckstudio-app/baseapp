// useAuth client-order: a claims-read failure reaches a TERMINAL state
// (never an infinite loading screen), a resolver throw still ends ready,
// and a superseded async resolution never overwrites a newer principal.
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { create, act } from "react-test-renderer";
import React, { createElement } from "react";

const h = vi.hoisted(() => ({
  cb: null as null | ((user: unknown) => Promise<void>),
  resolve: vi.fn(),
  resolveStaff: vi.fn(),
  unsub: vi.fn(),
}));

vi.mock("../lib/auth-service", () => ({
  onIdTokenChanged: (cb: (user: unknown) => Promise<void>) => {
    h.cb = cb;
    return h.unsub;
  },
  resolveMyCustomerDocResolution: () => h.resolve(),
  resolveExistingCustomerDocId: () => h.resolveStaff(),
}));
vi.mock("../lib/price-cache", () => ({ priceCache: { setScope: () => {} } }));

import { useAuth } from "./useAuth";

function Probe({ onState }: { onState: (s: unknown) => void }) {
  const s = useAuth();
  onState(s);
  return null;
}

const userA = {
  uid: "uid-A",
  getIdTokenResult: async () => ({
    claims: { role: "customer", tenantId: "automodz" },
  }),
};
const userB = {
  uid: "uid-B",
  getIdTokenResult: async () => ({
    claims: { role: "customer", tenantId: "automodz" },
  }),
};

let last: { status: string; [k: string]: unknown };
let renderer: ReturnType<typeof create>;
async function mount() {
  await act(async () => {
    renderer = create(
      createElement(Probe, {
        onState: (s) => {
          last = s as typeof last;
        },
      }),
    );
  });
}
afterEach(async () => {
  try {
    await act(async () => {
      renderer?.unmount();
    });
  } catch {
    /* already gone */
  }
});
async function fire(user: unknown) {
  await act(async () => {
    await h.cb!(user);
  });
}

beforeEach(() => {
  h.cb = null;
  h.resolve.mockReset();
  h.resolveStaff.mockReset();
  h.unsub.mockReset();
  last = { status: "init" };
});

describe("useAuth terminal + stale-async behavior", () => {
  it("claims read failure lands terminal unauthenticated, not a hang", async () => {
    await mount();
    await fire({
      uid: "uid-X",
      getIdTokenResult: async () => {
        throw new Error("network");
      },
    });
    expect(last.status).toBe("unauthenticated");
  });

  it("resolver throw still ends ready with null customerDocId and error outcome", async () => {
    h.resolve.mockRejectedValue(new Error("boom"));
    await mount();
    await fire(userA);
    expect(last.status).toBe("ready");
    expect((last as { customerDocId?: unknown }).customerDocId).toBeNull();
    expect((last as { customerDocResolution?: unknown }).customerDocResolution).toBe("error");
  });

  it("normal resolution: ready carries the canonical id", async () => {
    h.resolve.mockResolvedValue({ outcome: "resolved", customerDocId: "staged-9" });
    await mount();
    await fire(userA);
    expect(last.status).toBe("ready");
    expect((last as { customerDocId?: unknown }).customerDocId).toBe(
      "staged-9",
    );
    expect((last as { customerDocResolution?: unknown }).customerDocResolution).toBe("resolved");
  });

  it("customer claim-required resolves to null id with its own outcome", async () => {
    h.resolve.mockResolvedValue({ outcome: "claim-required" });
    await mount();
    await fire(userA);
    expect(last.status).toBe("ready");
    expect((last as { customerDocId?: unknown }).customerDocId).toBeNull();
    expect((last as { customerDocResolution?: unknown }).customerDocResolution).toBe("claim-required");
  });

  it("staff role resolves an existing verified record read-only", async () => {
    h.resolveStaff.mockResolvedValue({ outcome: "resolved", customerDocId: "uid-S" });
    await mount();
    await fire({
      uid: "uid-S",
      getIdTokenResult: async () => ({ claims: { role: "admin", tenantId: "automodz" } }),
    });
    expect(last.status).toBe("ready");
    expect((last as { customerDocId?: unknown }).customerDocId).toBe("uid-S");
    expect((last as { customerDocResolution?: unknown }).customerDocResolution).toBe("resolved");
    expect(h.resolve).not.toHaveBeenCalled(); // staff never take the self-serve path
  });

  it("staff with no record is absent, and a staff resolution error stays truthful", async () => {
    h.resolveStaff.mockResolvedValueOnce({ outcome: "absent" });
    await mount();
    await fire({
      uid: "uid-S1",
      getIdTokenResult: async () => ({ claims: { role: "studio", tenantId: "automodz" } }),
    });
    expect((last as { customerDocId?: unknown }).customerDocId).toBeNull();
    expect((last as { customerDocResolution?: unknown }).customerDocResolution).toBe("absent");
    h.resolveStaff.mockResolvedValueOnce({ outcome: "error" });
    await fire({
      uid: "uid-S2",
      getIdTokenResult: async () => ({ claims: { role: "admin", tenantId: "automodz" } }),
    });
    expect((last as { customerDocId?: unknown }).customerDocId).toBeNull();
    expect((last as { customerDocResolution?: unknown }).customerDocResolution).toBe("error");
    expect(h.resolve).not.toHaveBeenCalled();
  });

  it("a superseded resolution never overwrites the newer principal", async () => {
    let resolveA!: (v: { outcome: string; customerDocId?: string }) => void;
    h.resolve
      .mockImplementationOnce(
        () =>
          new Promise<{ outcome: string; customerDocId?: string }>((r) => {
            resolveA = r;
          }),
      ) // A: slow
      .mockResolvedValueOnce({ outcome: "resolved", customerDocId: "id-B" }); // B: fast
    await mount();
    const pA = h.cb!(userA); // in flight, not awaited, no act wrapper
    await act(async () => {
      await Promise.resolve();
    }); // let A reach its pending resolve
    await act(async () => {
      await h.cb!(userB);
    });
    expect((last as unknown as { user: { uid: string } }).user.uid).toBe(
      "uid-B",
    );
    resolveA({ outcome: "resolved", customerDocId: "id-A-STALE" });
    await act(async () => {
      await pA.catch(() => {});
    });
    expect((last as unknown as { user: { uid: string } }).user.uid).toBe(
      "uid-B",
    );
    expect((last as { customerDocId?: unknown }).customerDocId).toBe("id-B");
  });

  it("sign-out during resolution never lands ready for the old account", async () => {
    let resolveA!: (v: { outcome: string; customerDocId?: string }) => void;
    h.resolve.mockImplementationOnce(
      () =>
        new Promise<{ outcome: string; customerDocId?: string }>((r) => {
          resolveA = r;
        }),
    );
    await mount();
    const pA = h.cb!(userA); // in flight, not awaited
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await h.cb!(null);
    });
    expect(last.status).toBe("unauthenticated");
    resolveA({ outcome: "resolved", customerDocId: "id-A-STALE" });
    await act(async () => {
      await pA.catch(() => {});
    });
    expect(last.status).toBe("unauthenticated");
  });
});

describe("useAuth unmount", () => {
  it("a resolution still in flight at unmount never lands", async () => {
    let resolveA!: (v: { outcome: string; customerDocId?: string }) => void;
    h.resolve.mockImplementationOnce(
      () =>
        new Promise<{ outcome: string; customerDocId?: string }>((r) => {
          resolveA = r;
        }),
    );
    await mount();
    const pA = h.cb!(userA);
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.unsub).not.toHaveBeenCalled();
    await act(async () => {
      renderer.unmount();
    }); // act flushes the deferred effect cleanup
    expect(h.unsub).toHaveBeenCalledTimes(1); // effect cleanup ran: unsubscribe + generation bump
    resolveA({ outcome: "resolved", customerDocId: "id-A-LATE" });
    await act(async () => {
      await pA.catch(() => {});
    }); // must not reject
    expect(last.status).toBe("loading"); // never overwritten after unmount
  });
});

import { CustomerSessionBoundary } from "../ui/CustomerSessionBoundary";
it("actual session boundary immediately drops former private route while replacement token/identity is unresolved, then remounts cleanly", async () => {
  const mounted = vi.fn(),
    unmounted = vi.fn();
  function Private() {
    React.useEffect(() => {
      mounted();
      return () => unmounted();
    }, []);
    return React.createElement("private", null, "OLD PRIVATE ROUTE");
  }
  h.resolve.mockResolvedValue({ outcome: "resolved", customerDocId: "canonical-A" });
  let r: any;
  await act(async () => {
    r = create(
      React.createElement(
        CustomerSessionBoundary,
        null,
        React.createElement(Private),
      ),
    );
  });
  await fire(userA);
  expect(r.root.findAllByType("private")).toHaveLength(1);
  let resolveToken: any;
  const next = {
    uid: "uid-B",
    getIdTokenResult: () =>
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
  };
  let pending: any;
  await act(async () => {
    pending = h.cb!(next);
    await Promise.resolve();
  });
  expect(r.root.findAllByType("private")).toHaveLength(0);
  h.resolve.mockResolvedValue({ outcome: "resolved", customerDocId: "canonical-B" });
  await act(async () => {
    resolveToken({ claims: { role: "customer", tenantId: "automodz" } });
    await pending;
  });
  expect(r.root.findAllByType("private")).toHaveLength(1);
  expect(unmounted).toHaveBeenCalled();
  await act(async () => r.unmount());
});

it("refresh with revoked/missing claims clears canonical customer and reaches setup state, never prior ready identity", async () => {
  h.resolve.mockResolvedValue({ outcome: "resolved", customerDocId: "canonical-A" });
  await mount();
  await fire(userA);
  expect(last.customerDocId).toBe("canonical-A");
  await fire({ uid: "uid-A", getIdTokenResult: async () => ({ claims: {} }) });
  expect(last.status).toBe("authenticated_no_claims");
  expect(last.customerDocId).toBeUndefined();
  expect(h.resolve).toHaveBeenCalledTimes(1);
});
it("restored signed-out session becomes terminal unauthenticated; restored customer resolves its canonical identity", async () => {
  await mount();
  await fire(null);
  expect(last.status).toBe("unauthenticated");
  h.resolve.mockResolvedValue({ outcome: "resolved", customerDocId: "restored-canonical" });
  await fire(userB);
  expect(last.status).toBe("ready");
  expect(last.customerDocId).toBe("restored-canonical");
});
