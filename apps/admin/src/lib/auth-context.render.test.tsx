// The REAL AdminAuthProvider with firebase/fetch mocked at the boundary:
// proves the reactive subscription observes ID-TOKEN changes (including a
// same-uid refresh with new claims), sequences events latest-only, marks the
// session verifying immediately, never lets an old failed event sign out a
// newer one, and never treats the cookie alone as latest-role proof.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";

let tokenListener: ((u: unknown) => void) | null = null;
const signOutMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("firebase/auth", () => ({
  onIdTokenChanged: (_a: unknown, cb: (u: unknown) => void) => { tokenListener = cb; return () => { tokenListener = null; }; },
  onAuthStateChanged: () => () => {},
  GoogleAuthProvider: class { setCustomParameters() {} },
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: async () => null,
  signOut: signOutMock,
  getMultiFactorResolver: vi.fn(),
  PhoneAuthProvider: class {},
  PhoneMultiFactorGenerator: class {},
  RecaptchaVerifier: class {},
}));
vi.mock("./firebase", () => ({ auth: {}, db: {}, functions: {}, storage: {} }));
vi.mock("./mfa", () => ({ isMultiFactorRequiredError: () => false, pickPhoneHint: () => null }));
vi.mock("./browser", () => ({ currentUserAgent: () => "test", isInAppBrowser: () => false, isIosBrowser: () => false, shouldFallBackToRedirect: () => false }));

type Claims = Record<string, unknown>;
// Server responses. Queues serve deferred tests in arrival order; the plain
// fields are the default answers when a queue is empty.
let cookieClaims: Claims | null = null;
let exchangeClaims: Claims | null = null;
let resolveOk = true;
const getQueue: (Claims | null)[] = [];
const postQueue: (Claims | null)[] = [];
const resolveQueue: boolean[] = [];
let deferFetches = false;
const pendingFetches: Array<() => void> = [];
const fetchCalls: string[] = [];
vi.stubGlobal("fetch", (url: string, init?: { method?: string }) => {
  const method = init?.method ?? "GET";
  const respond = () => {
    fetchCalls.push(`${method} ${url}`);
    const json = (v: unknown) => async () => v;
    if (url === "/api/session" && method === "GET") {
      const c = getQueue.length ? getQueue.shift()! : cookieClaims;
      return c ? { ok: true, status: 200, json: json({ claims: c }) } : { ok: false, status: 401, json: json({}) };
    }
    if (url === "/api/session" && method === "POST") {
      const c = postQueue.length ? postQueue.shift()! : exchangeClaims;
      return c ? { ok: true, status: 200, json: json({ claims: c }) } : { ok: false, status: 401, json: json({}) };
    }
    if (url === "/api/auth/resolve-claims") {
      const ok = resolveQueue.length ? resolveQueue.shift()! : resolveOk;
      return ok ? { ok: true, status: 200, json: json({ changed: false }) } : { ok: false, status: 500, json: json({}) };
    }
    return { ok: false, status: 404, json: json({}) };
  };
  // Compute the response at REQUEST time (each request gets its own queued
  // answer); deferring only the RESOLUTION lets tests control landing order
  // independently of request order.
  const response = respond();
  if (deferFetches) return new Promise((res) => { pendingFetches.push(() => res(response)); });
  return Promise.resolve(response);
});
const resolvePending = () => { const p = pendingFetches.splice(0); p.forEach((r) => r()); };
const resolveAt = (i: number) => { const p = pendingFetches.splice(i, 1); p.forEach((r) => r()); };

import { AdminAuthProvider, useAdminAuth } from "./auth-context";

const mkUser = (uid: string, claims: Claims) => ({ uid, getIdToken: async () => `tok-${uid}`, getIdTokenResult: async () => ({ claims }) });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

const renders: string[] = [];
function Probe() {
  const { claims, loading } = useAdminAuth();
  renders.push(loading ? "loading" : claims ? `role:${String(claims.role)}` : "anon");
  return createElement("span", null, renders[renders.length - 1]);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const textOf = (el: any): string => {
  const walk = (n: any): string => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (n == null || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    return walk(n.children);
  };
  return walk(el.toJSON());
};

beforeEach(() => {
  tokenListener = null;
  cookieClaims = null; exchangeClaims = null; resolveOk = true;
  getQueue.length = 0; postQueue.length = 0; resolveQueue.length = 0;
  deferFetches = false; pendingFetches.length = 0; fetchCalls.length = 0;
  renders.length = 0; signOutMock.mockClear();
});

describe("AdminAuthProvider token observation", () => {
  it("subscribes with onIdTokenChanged and revalidates on a same-uid token refresh with new claims", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(AdminAuthProvider, null, createElement(Probe))); });
    expect(tokenListener).not.toBeNull();
    const user = mkUser("u1", { role: "studio", tenantId: "t", studioId: "s1" });
    cookieClaims = { uid: "u1", role: "studio", tenantId: "t", studioId: "s1" };
    await act(async () => { tokenListener?.(user); });
    await flush();
    expect(textOf(el)).toContain("role:studio");
    const callsAfterFirst = fetchCalls.length;
    // Same uid, refreshed token, server session now carries a new role:
    // onAuthStateChanged would NOT fire here; onIdTokenChanged must.
    const refreshed = mkUser("u1", { role: "admin", tenantId: "t", studioId: null });
    cookieClaims = { uid: "u1", role: "admin", tenantId: "t", studioId: null };
    await act(async () => { tokenListener?.(refreshed); });
    await flush();
    expect(fetchCalls.length).toBeGreaterThan(callsAfterFirst); // session revalidated
    expect(textOf(el)).toContain("role:admin");
  });

  it("sign-out observed through the token listener clears claims", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(AdminAuthProvider, null, createElement(Probe))); });
    cookieClaims = { uid: "u1", role: "studio", tenantId: "t", studioId: "s1" };
    await act(async () => { tokenListener?.(mkUser("u1", { role: "studio", tenantId: "t", studioId: "s1" })); });
    await flush();
    expect(textOf(el)).toContain("role:studio");
    await act(async () => { tokenListener?.(null); });
    await flush();
    expect(textOf(el)).toContain("anon");
  });

  it("a slow earlier event never publishes over a newer one (latest-only)", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(AdminAuthProvider, null, createElement(Probe))); });
    deferFetches = true;
    getQueue.push({ uid: "uA", role: "studio", tenantId: "t", studioId: "s1" }); // A's session read
    getQueue.push({ uid: "uB", role: "admin", tenantId: "t", studioId: null }); // B's session read
    await act(async () => { tokenListener?.(mkUser("uA", { role: "studio", tenantId: "t", studioId: "s1" })); });
    await act(async () => { tokenListener?.(mkUser("uB", { role: "admin", tenantId: "t", studioId: null })); });
    expect(textOf(el)).toContain("loading"); // verifying while the newest event resolves
    resolvePending(); // A's read resolves first, late
    await flush();
    expect(renders).not.toContain("role:studio"); // A never published
    expect(textOf(el)).toContain("role:admin"); // B won
  });

  it("an old FAILED event never signs out a newer one", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(AdminAuthProvider, null, createElement(Probe))); });
    deferFetches = true;
    getQueue.push(null); // A: no cookie session (would need a resolve-claims POST)
    getQueue.push({ uid: "uB", role: "admin", tenantId: "t", studioId: null }); // B: healthy
    await act(async () => { tokenListener?.(mkUser("uA", { role: "studio", tenantId: "t", studioId: "s1" })); });
    await act(async () => { tokenListener?.(mkUser("uB", { role: "admin", tenantId: "t", studioId: null })); });
    resolvePending();
    await flush();
    expect(signOutMock).not.toHaveBeenCalled(); // superseded failure must not sign out
    // The superseded A must produce NO stale external mutation: its GET
    // resolved after B arrived, so it stopped before any POST.
    expect(fetchCalls.filter((c) => c.startsWith("POST"))).toEqual([]);
    expect(textOf(el)).toContain("role:admin");
  });

  it("sign-out during a pending resolution wins; the late resolution publishes nothing", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(AdminAuthProvider, null, createElement(Probe))); });
    deferFetches = true;
    getQueue.push({ uid: "uA", role: "studio", tenantId: "t", studioId: "s1" });
    await act(async () => { tokenListener?.(mkUser("uA", { role: "studio", tenantId: "t", studioId: "s1" })); });
    await act(async () => { tokenListener?.(null); });
    expect(textOf(el)).toContain("anon");
    resolvePending();
    await flush();
    expect(textOf(el)).toContain("anon");
    expect(renders).not.toContain("role:studio");
    expect(signOutMock).not.toHaveBeenCalled(); // explicit sign-out event needs no SDK sign-out
  });

  // SCOPE: this is a late-GET state-publication regression only. Both queued
  // responses are GET /api/session reads; there is no POST, no Set-Cookie, no
  // cookie jar, and no healing here. The POST/Set-Cookie ordering boundary
  // (an already-inflight POST's Set-Cookie cannot be recalled by pre-launch
  // liveness checks) is NOT covered by this test and remains open.
  it("a stale GET state response landing AFTER a newer event published never overwrites it (late-GET state publication)", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(AdminAuthProvider, null, createElement(Probe))); });
    deferFetches = true;
    getQueue.push({ uid: "uA", role: "studio", tenantId: "t", studioId: "s1" }); // A's cookie read
    getQueue.push({ uid: "uB", role: "admin", tenantId: "t", studioId: null }); // B's cookie read
    await act(async () => { tokenListener?.(mkUser("uA", { role: "studio", tenantId: "t", studioId: "s1" })); });
    await act(async () => { tokenListener?.(mkUser("uB", { role: "admin", tenantId: "t", studioId: null })); });
    // B's HTTP answer arrives FIRST and publishes; A's stale answer lands after.
    resolveAt(1);
    await flush(); await flush();
    expect(textOf(el)).toContain("role:admin");
    resolveAt(0);
    await flush(); await flush();
    expect(renders).not.toContain("role:studio"); // the late stale response published nothing
    expect(textOf(el)).toContain("role:admin");
  });

  it("a cookie STALE relative to the refreshed token is re-exchanged: the cookie alone is not latest-role proof", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(AdminAuthProvider, null, createElement(Probe))); });
    // Cookie says studio (minted before the role change); the refreshed token
    // carries admin. The provider must re-exchange the fresh token and publish
    // what the server confirms, not trust the cookie.
    cookieClaims = { uid: "u1", role: "studio", tenantId: "t", studioId: "s1" };
    exchangeClaims = { uid: "u1", role: "admin", tenantId: "t", studioId: null };
    await act(async () => { tokenListener?.(mkUser("u1", { role: "admin", tenantId: "t", studioId: "s1" })); });
    await flush();
    expect(fetchCalls).toContain("POST /api/session"); // re-exchanged
    expect(textOf(el)).toContain("role:admin");
  });

  it("an unreadable token BLOCKS on the old cookie and re-exchanges the current token instead", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(AdminAuthProvider, null, createElement(Probe))); });
    const broken = { uid: "u1", getIdToken: async () => "tok", getIdTokenResult: async () => { throw new Error("token read failed"); } };
    // The cookie alone is NOT proof: with the token scope unreadable the
    // provider must re-exchange the CURRENT token and publish what the
    // server binds to it - not the stale cookie's claims.
    cookieClaims = { uid: "u1", role: "studio", tenantId: "t", studioId: "s1" };
    exchangeClaims = { uid: "u1", role: "admin", tenantId: "t", studioId: null };
    await act(async () => { tokenListener?.(broken); });
    await flush();
    expect(fetchCalls).toContain("POST /api/session"); // re-exchanged, cookie not trusted
    expect(textOf(el)).toContain("role:admin");
    // When the re-exchange ALSO fails, the provider fails closed and signs out.
    cookieClaims = null; exchangeClaims = null; resolveOk = false;
    await act(async () => { tokenListener?.(mkUser("u1", { role: "studio", tenantId: "t", studioId: "s1" })); });
    await flush();
    expect(textOf(el)).toContain("anon");
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it("a cookie with the SAME scope but a DIFFERENT uid is not accepted for this principal", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(AdminAuthProvider, null, createElement(Probe))); });
    // The cookie's scope matches the token exactly, but it was minted for
    // another account: claims without a matching uid prove nothing - the
    // provider must re-exchange and publish claims bound to THIS uid.
    cookieClaims = { uid: "u9", role: "studio", tenantId: "t", studioId: "s1" };
    exchangeClaims = { uid: "u1", role: "studio", tenantId: "t", studioId: "s1" };
    await act(async () => { tokenListener?.(mkUser("u1", { role: "studio", tenantId: "t", studioId: "s1" })); });
    await flush();
    expect(fetchCalls).toContain("POST /api/session"); // re-exchanged
    expect(textOf(el)).toContain("role:studio");
  });
});
