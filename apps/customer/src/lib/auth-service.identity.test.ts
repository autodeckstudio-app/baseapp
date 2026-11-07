// Canonical customer-doc-id resolution: ownership is the DATA (authUid +
// validated tenant claim + not deleted), never readability. Client-order
// coverage: legacy, stored hit, stored mismatch -> setup, claimRequired,
// setup throw, transient read error (no fall-through to the mutating call),
// principal switch mid-flight, deletion pending.
import { describe, expect, it, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  token: vi.fn(),
  setup: vi.fn(),
  uid: "uid-1",
  store: new Map<string, string>(),
}));

vi.mock("../lib/firebase", () => ({
  auth: { get currentUser() { return h.uid ? { uid: h.uid, getIdTokenResult: () => h.token() } : null; } },
  db: {},
  functions: {},
  useEmulator: false,
  emulatorBackend: false,
}));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...parts: string[]) => ({ parts }),
  getDoc: () => h.getDoc(),
  collection: (_db: unknown, ...parts: string[]) => ({ parts }),
  query: (...a: unknown[]) => ({ a }),
  where: (...a: unknown[]) => ({ a }),
  limit: (n: number) => ({ n }),
  getDocs: () => h.getDocs(),
}));
vi.mock("firebase/functions", () => ({
  httpsCallable: (_f: unknown, name: string) => async (data?: unknown) => {
    if (name === "setupCustomerProfile") return { data: await h.setup(data) };
    if (name === "claimCustomerRecord") return { data: { customerId: "staged-1" } };
    return { data: {} };
  },
}));
vi.mock("firebase/auth", () => ({}));
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { customers: () => "customers" } }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => h.store.get(k) ?? null,
    setItem: async (k: string, v: string) => { h.store.set(k, v); },
    removeItem: async (k: string) => { h.store.delete(k); },
  },
}));

import { verifyMyCustomerDocId, getMyCustomerDocId, resolveMyCustomerDocId, resolveExistingCustomerDocId } from "./auth-service";

const snap = (d: Record<string, unknown> | undefined) => ({ exists: () => d !== undefined, data: () => d });
const mine = { authUid: "uid-1", tenantId: "automodz", deletedAt: null };
const KEY = "autodeck.customerDocId.uid-1";

beforeEach(() => {
  h.getDoc.mockReset(); h.getDocs.mockReset(); h.setup.mockReset(); h.token.mockReset();
  h.uid = "uid-1"; h.store.clear();
  h.token.mockResolvedValue({ claims: { tenantId: "automodz" } });
  h.setup.mockResolvedValue({ claimRequired: true });
  h.getDocs.mockResolvedValue({ docs: [] });
});

describe("verifyMyCustomerDocId", () => {
  it("accepts only authUid+tenant match, not deleted", async () => {
    h.getDoc.mockResolvedValue(snap(mine));
    await expect(verifyMyCustomerDocId("staged-1")).resolves.toBe(true);
  });
  it("rejects staff-readable doc bound to another uid, wrong tenant, deleted, missing", async () => {
    h.getDoc.mockResolvedValueOnce(snap({ ...mine, authUid: "uid-2" }));
    await expect(verifyMyCustomerDocId("a")).resolves.toBe(false);
    h.getDoc.mockResolvedValueOnce(snap({ ...mine, tenantId: "other" }));
    await expect(verifyMyCustomerDocId("a")).resolves.toBe(false);
    h.getDoc.mockResolvedValueOnce(snap({ ...mine, deletedAt: "2026-01-01" }));
    await expect(verifyMyCustomerDocId("a")).resolves.toBe(false);
    h.getDoc.mockResolvedValueOnce(snap(undefined));
    await expect(verifyMyCustomerDocId("a")).resolves.toBe(false);
  });
  it("fails closed without a tenant claim and on read errors", async () => {
    h.token.mockResolvedValueOnce({ claims: {} });
    await expect(verifyMyCustomerDocId("a")).resolves.toBe(false);
    h.getDoc.mockRejectedValueOnce(new Error("permission-denied"));
    await expect(verifyMyCustomerDocId("a")).resolves.toBe(false);
  });
});

describe("getMyCustomerDocId", () => {
  it("returns uid only when the doc at uid is verified mine", async () => {
    h.getDoc.mockResolvedValue(snap(mine));
    await expect(getMyCustomerDocId()).resolves.toBe("uid-1");
    h.getDoc.mockResolvedValue(snap(undefined));
    await expect(getMyCustomerDocId()).resolves.toBeNull();
  });
});

describe("resolveMyCustomerDocId", () => {
  it("legacy: doc at uid is mine - returns uid, never calls setup", async () => {
    h.getDoc.mockResolvedValue(snap(mine));
    await expect(resolveMyCustomerDocId()).resolves.toBe("uid-1");
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("stored hit: no doc at uid, persisted claimed id verifies - no setup call", async () => {
    h.store.set(KEY, "staged-9");
    h.getDoc.mockImplementation(() => Promise.resolve(snap(undefined))); // uid doc missing
    h.getDoc.mockImplementationOnce(() => Promise.resolve(snap(undefined)))
      .mockImplementationOnce(() => Promise.resolve(snap({ ...mine }))); // stored verifies
    await expect(resolveMyCustomerDocId()).resolves.toBe("staged-9");
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("stored mismatch: falls to setup, verifies the returned claimed id, persists it", async () => {
    h.store.set(KEY, "staged-OLD");
    h.setup.mockResolvedValue({ customer: { id: "staged-9", authUid: "uid-1" }, isNew: false });
    const reads: string[] = [];
    h.getDoc.mockImplementation(() => {
      const which = reads.length === 0 ? "uid" : reads.length === 1 ? "stored" : "setup-id";
      reads.push(which);
      if (which === "setup-id") return Promise.resolve(snap(mine));
      return Promise.resolve(snap(undefined));
    });
    await expect(resolveMyCustomerDocId()).resolves.toBe("staged-9");
    expect(h.setup).toHaveBeenCalledTimes(1);
    expect(h.store.get(KEY)).toBe("staged-9");
  });

  it("claimRequired from setup: null, nothing persisted", async () => {
    h.getDoc.mockResolvedValue(snap(undefined));
    h.setup.mockResolvedValue({ claimRequired: true, renewalRequired: true });
    await expect(resolveMyCustomerDocId()).resolves.toBeNull();
    expect(h.store.has(KEY)).toBe(false);
  });

  it("setup throws: null (terminal), nothing persisted", async () => {
    h.getDoc.mockResolvedValue(snap(undefined));
    h.setup.mockRejectedValue(new Error("unavailable"));
    await expect(resolveMyCustomerDocId()).resolves.toBeNull();
  });

  it("transient read error on the fast path: null WITHOUT calling setup", async () => {
    h.getDoc.mockRejectedValue(new Error("network"));
    await expect(resolveMyCustomerDocId()).resolves.toBeNull();
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("transient read error verifying the stored id: null WITHOUT calling setup", async () => {
    h.store.set(KEY, "staged-9");
    h.getDoc.mockImplementationOnce(() => Promise.resolve(snap(undefined)))
      .mockImplementationOnce(() => Promise.reject(new Error("appcheck")));
    await expect(resolveMyCustomerDocId()).resolves.toBeNull();
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("deletion pending: fast path refuses a deleted doc at uid", async () => {
    h.getDoc.mockResolvedValue(snap({ ...mine, deletedAt: "2026-11-01T00:00:00Z" }));
    h.setup.mockResolvedValue({ claimRequired: true });
    await expect(resolveMyCustomerDocId()).resolves.toBeNull();
  });

  it("principal switch mid-flight: result discarded, nothing persisted", async () => {
    h.getDoc.mockResolvedValue(snap(undefined));
    h.setup.mockImplementation(async () => {
      h.uid = "uid-2"; // account switch while setup is in flight
      return { customer: { id: "staged-9" }, isNew: false };
    });
    await expect(resolveMyCustomerDocId()).resolves.toBeNull();
    expect(h.store.has(KEY)).toBe(false);
  });
});

describe("resolveExistingCustomerDocId (staff read-only)", () => {
  it("legacy doc at uid verifies: resolved, setup NEVER called", async () => {
    h.getDoc.mockResolvedValue(snap(mine));
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "resolved", customerDocId: "uid-1" });
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("no record anywhere: absent, setup NEVER called (staff resolution can never create)", async () => {
    h.getDoc.mockResolvedValue(snap(undefined));
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "absent" });
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("persisted claimed id verifies for a staff account: resolved read-only", async () => {
    h.store.set(KEY, "staged-9");
    h.getDoc.mockImplementationOnce(() => Promise.resolve(snap(undefined)))
      .mockImplementationOnce(() => Promise.resolve(snap({ ...mine })));
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "resolved", customerDocId: "staged-9" });
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("stale stored id (doc gone or cross-user) fails ownership: absent, never setup", async () => {
    h.store.set(KEY, "staged-OLD");
    h.getDoc.mockResolvedValue(snap(undefined)); // uid doc and stored doc both missing
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "absent" });
    expect(h.setup).not.toHaveBeenCalled();
    h.store.set(KEY, "staged-OTHER");
    h.getDoc.mockImplementationOnce(() => Promise.resolve(snap(undefined)))
      .mockImplementationOnce(() => Promise.resolve(snap({ ...mine, authUid: "uid-2" }))); // bound to another user
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "absent" });
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("deleted stored record fails ownership: absent", async () => {
    h.store.set(KEY, "staged-9");
    h.getDoc.mockImplementationOnce(() => Promise.resolve(snap(undefined)))
      .mockImplementationOnce(() => Promise.resolve(snap({ ...mine, deletedAt: "2026-11-01" })));
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "absent" });
  });

  it("transient read errors surface as error (unknown), never absent", async () => {
    h.getDoc.mockRejectedValue(new Error("network"));
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "error" });
    h.getDoc.mockReset();
    h.store.set(KEY, "staged-9");
    h.getDoc.mockImplementationOnce(() => Promise.resolve(snap(undefined)))
      .mockImplementationOnce(() => Promise.reject(new Error("appcheck")));
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "error" });
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("principal switch mid-flight never resolves", async () => {
    h.getDoc.mockImplementation(async () => {
      h.uid = "uid-2";
      return snap(mine);
    });
    const r = await resolveExistingCustomerDocId();
    expect(r.outcome).not.toBe("resolved");
  });

  it("new-device discovery: one live authUid+tenant candidate resolves and persists, setup never called", async () => {
    h.getDoc.mockImplementation(() => Promise.resolve(snap(undefined))); // uid doc missing
    h.getDocs.mockResolvedValue({ docs: [{ id: "staged-9", data: () => ({ deletedAt: null }) }] });
    h.getDoc.mockImplementationOnce(() => Promise.resolve(snap(undefined))) // fast path uid
      .mockImplementationOnce(() => Promise.resolve(snap(mine))); // probe of discovered id
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "resolved", customerDocId: "staged-9" });
    expect(h.store.get(KEY)).toBe("staged-9");
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("discovery ambiguity (two live candidates) is truthful error, never a pick", async () => {
    h.getDoc.mockResolvedValue(snap(undefined));
    h.getDocs.mockResolvedValue({ docs: [
      { id: "staged-9", data: () => ({ deletedAt: null }) },
      { id: "staged-10", data: () => ({ deletedAt: null }) },
    ] });
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "error" });
    expect(h.store.has(KEY)).toBe(false);
    expect(h.setup).not.toHaveBeenCalled();
  });

  it("discovery with only deleted candidates is a founded absent", async () => {
    h.getDoc.mockResolvedValue(snap(undefined));
    h.getDocs.mockResolvedValue({ docs: [{ id: "staged-9", data: () => ({ deletedAt: "2026-11-01" }) }] });
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "absent" });
    expect(h.store.has(KEY)).toBe(false);
  });

  it("discovery query failure is error (unknown), never absent", async () => {
    h.getDoc.mockResolvedValue(snap(undefined));
    h.getDocs.mockRejectedValue(new Error("permission-denied"));
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "error" });
  });

  it("auth switch A->B->A: cached id for A re-verifies, B never inherits it", async () => {
    h.store.set(KEY, "staged-9");
    h.getDoc.mockImplementationOnce(() => Promise.resolve(snap(undefined)))
      .mockImplementationOnce(() => Promise.resolve(snap(mine)));
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "resolved", customerDocId: "staged-9" });
    // Switch to B: per-uid cache key means B has no stored id; B's own walk runs.
    h.uid = "uid-2";
    h.token.mockResolvedValue({ claims: { tenantId: "automodz" } });
    h.getDoc.mockResolvedValue(snap(undefined));
    h.getDocs.mockResolvedValue({ docs: [] });
    await expect(resolveExistingCustomerDocId()).resolves.toEqual({ outcome: "absent" });
    expect(h.store.has("autodeck.customerDocId.uid-2")).toBe(false);
  });
});
