// Sequencing contract of onStaffAuthChanged: token resolution is async, so
// events are numbered and only the LATEST event's resolution is delivered.
import { beforeEach, describe, expect, it, vi } from "vitest";

let idTokenListener: ((u: unknown) => void) | null = null;
vi.mock("firebase/auth", () => ({
  onIdTokenChanged: (_auth: unknown, cb: (u: unknown) => void) => { idTokenListener = cb; return () => { idTokenListener = null; }; },
}));
vi.mock("firebase/firestore", () => ({}));
vi.mock("firebase/functions", () => ({}));
vi.mock("./firebase", () => ({ auth: {}, db: {}, functions: {} }));

import { onStaffAuthChanged } from "./studio-service";

const user = (claims: Record<string, unknown> | Error, uid = "u1") => ({
  uid,
  getIdTokenResult: () => claims instanceof Error ? Promise.reject(claims) : Promise.resolve({ claims }),
});
const deferredUser = (uid = "u1") => {
  let resolve!: (v: { claims: Record<string, unknown> }) => void;
  let reject!: (e: Error) => void;
  const u = { uid, getIdTokenResult: () => new Promise((res, rej) => { resolve = res; reject = rej; }) };
  return { u, resolve: (v: { claims: Record<string, unknown> }) => resolve(v), reject: (e: Error) => reject(e) };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => { idTokenListener = null; });

describe("onStaffAuthChanged sequencing", () => {
  it("a slow older token resolution never publishes after a newer event", async () => {
    const seen: unknown[] = [];
    onStaffAuthChanged((a) => seen.push(a));
    const A = deferredUser("uA");
    idTokenListener?.(A.u); // event 1: slow -> immediate verifying
    expect(seen).toEqual([undefined]); // synchronous, before any resolution
    idTokenListener?.(user({ role: "studio", tenantId: "t", studioId: "s1" }, "uB")); // event 2: fast
    expect(seen).toEqual([undefined, undefined]); // event 2 also verifies immediately
    await flush();
    expect(seen).toEqual([undefined, undefined, { uid: "uB", role: "studio", tenantId: "t", studioId: "s1" }]);
    A.resolve({ claims: { role: "admin", tenantId: "t", studioId: null } }); // stale event 1 lands late
    await flush();
    expect(seen).toHaveLength(3); // never delivered
  });

  it("sign-out while a token fetch is pending publishes null; the late token is ignored", async () => {
    const seen: unknown[] = [];
    onStaffAuthChanged((a) => seen.push(a));
    const A = deferredUser("uA");
    idTokenListener?.(A.u);
    expect(seen).toEqual([undefined]); // verifying first
    idTokenListener?.(null); // sign-out
    await flush();
    expect(seen).toEqual([undefined, null]);
    A.resolve({ claims: { role: "studio", tenantId: "t", studioId: "s1" } });
    await flush();
    expect(seen).toEqual([undefined, null]);
  });

  it("nothing is delivered after unsubscribe", async () => {
    const seen: unknown[] = [];
    const unsub = onStaffAuthChanged((a) => seen.push(a));
    unsub();
    expect(idTokenListener).toBeNull();
  });

  it("a claims-read failure fails CLOSED (null), never keeps the previous identity", async () => {
    const seen: unknown[] = [];
    onStaffAuthChanged((a) => seen.push(a));
    idTokenListener?.(user(new Error("token read failed")));
    await flush();
    expect(seen).toEqual([undefined, null]);
  });

  it("a prior affirmation is NOT serviceable while a newer token is pending", async () => {
    const seen: unknown[] = [];
    onStaffAuthChanged((a) => seen.push(a));
    idTokenListener?.(user({ role: "studio", tenantId: "t", studioId: "s1" }, "uA"));
    await flush();
    expect(seen).toEqual([undefined, { uid: "uA", role: "studio", tenantId: "t", studioId: "s1" }]);
    // New token event: the affirmed identity is replaced by `verifying`
    // SYNCHRONOUSLY - anything gating on the delivered value cannot service
    // the prior affirmation in this window.
    const B = deferredUser("uB");
    idTokenListener?.(B.u);
    expect(seen[seen.length - 1]).toBeUndefined(); // no flush needed: immediate
    B.resolve({ claims: { role: "studio", tenantId: "t", studioId: "s2" } });
    await flush();
    expect(seen[seen.length - 1]).toEqual({ uid: "uB", role: "studio", tenantId: "t", studioId: "s2" });
  });

  it("a pending event that resolves after unsubscribe delivers nothing", async () => {
    const seen: unknown[] = [];
    const unsub = onStaffAuthChanged((a) => seen.push(a));
    const A = deferredUser("uA");
    idTokenListener?.(A.u);
    expect(seen).toEqual([undefined]);
    unsub();
    A.resolve({ claims: { role: "studio", tenantId: "t", studioId: "s1" } });
    await flush();
    expect(seen).toEqual([undefined]); // resolve after unsubscribe: nothing more
  });
});
