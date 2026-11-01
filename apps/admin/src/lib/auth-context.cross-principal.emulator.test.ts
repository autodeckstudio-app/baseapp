/**
 * Cross-principal late-Set-Cookie race: an in-flight login exchange for
 * principal A lands in the cookie jar AFTER principal B's response, while
 * the browser's Firebase SDK now holds B. The REAL AdminAuthProvider runs
 * against the REAL /api/session route handlers and REAL Auth-emulator
 * tokens; only the network (fetch) and the Firebase client SDK are mocked.
 * The jar is a faithful minimal simulation: Set-Cookie headers are applied
 * in CHOSEN arrival order. Faithful-but-labeled: not a real browser jar,
 * not a concurrent browser - the out-of-order arrival is applied, not timed.
 */
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { create, act } from "react-test-renderer";
import { NextRequest, type NextResponse } from "next/server";
import { getAdminAuth } from "./firebase-admin";
import { POST, GET, SESSION_COOKIE_NAME } from "../app/api/session/route";

const adminAuth = getAdminAuth();
const AUTH_EMULATOR_HOST = process.env["FIREBASE_AUTH_EMULATOR_HOST"] ?? "localhost:9099";

const h = vi.hoisted(() => ({
  tokenCb: null as null | ((user: unknown) => void),
  states: [] as { loading: boolean; uid: string | null }[],
  fetchLog: [] as string[],
  postTokens: [] as string[],
}));

vi.mock("firebase/auth", () => ({
  onIdTokenChanged: (_auth: unknown, cb: (user: unknown) => void) => { h.tokenCb = cb; return () => {}; },
  GoogleAuthProvider: class { setCustomParameters() {} },
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(async () => undefined),
  getRedirectResult: vi.fn(async () => null),
  signOut: vi.fn(async () => undefined),
  getMultiFactorResolver: vi.fn(),
  PhoneAuthProvider: class {},
  PhoneMultiFactorGenerator: { FACTOR_ID: "phone" },
  RecaptchaVerifier: class {},
}));
vi.mock("./firebase", () => ({ auth: {} }));
vi.mock("./browser", () => ({
  currentUserAgent: () => "test-agent",
  isInAppBrowser: () => false,
  isIosBrowser: () => false,
  shouldFallBackToRedirect: () => false,
}));
vi.mock("./mfa", () => ({ isMultiFactorRequiredError: () => false, pickPhoneHint: () => null }));

import { AdminAuthProvider, useAdminAuth } from "./auth-context";

(globalThis as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = true;

async function mintIdToken(uid: string): Promise<string> {
  const customToken = await adminAuth.createCustomToken(uid);
  const res = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) },
  );
  if (!res.ok) throw new Error(`custom token exchange failed: ${res.status}`);
  return ((await res.json()) as { idToken: string }).idToken;
}

async function createPrincipal(label: string): Promise<{ uid: string; idToken: string }> {
  const uid = `xp-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await adminAuth.createUser({ uid, email: `${uid}@example.test`, emailVerified: true });
  await adminAuth.setCustomUserClaims(uid, { role: "admin", tenantId: "race-tenant", studioId: null });
  return { uid, idToken: await mintIdToken(uid) };
}

function postExchange(idToken: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

// Minimal faithful cookie jar: applies Set-Cookie headers in ARRIVAL order.
function makeJar() {
  const jar = new Map<string, string>();
  return {
    apply(res: NextResponse) {
      const header = res.headers.get("set-cookie");
      if (!header) return;
      const [pair] = header.split(";");
      const eq = pair!.indexOf("=");
      const name = pair!.slice(0, eq).trim();
      const value = pair!.slice(eq + 1).trim();
      if (/Max-Age=0(\D|$)/.test(header) || value === "") jar.delete(name);
      else jar.set(name, value);
    },
    cookie(name: string) { return jar.get(name); },
  };
}

describe("cross-principal late Set-Cookie race (mounted real provider + real routes)", () => {
  it("A's late Set-Cookie wins the jar while the SDK holds B: GET shows A, the provider publishes NO A claims, re-exchanges B and verifies B before READY", async () => {
    const a = await createPrincipal("a");
    const b = await createPrincipal("b");
    expect(a.uid).not.toBe(b.uid);

    // Two real exchanges; B's response is applied first, A's lands LATE.
    const resA = await POST(postExchange(a.idToken));
    const resB = await POST(postExchange(b.idToken));
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    const cookieA = resA.cookies.get(SESSION_COOKIE_NAME)!.value!;
    const cookieB = resB.cookies.get(SESSION_COOKIE_NAME)!.value!;
    expect(cookieA).not.toBe(cookieB); // the race is over DISTINCT cookies

    const jar = makeJar();
    jar.apply(resB);
    jar.apply(resA); // late A wins the jar
    expect(jar.cookie(SESSION_COOKIE_NAME)).toBe(cookieA);

    // Precondition: the next verification answers for A while the SDK holds B.
    const staleGet = await GET(new NextRequest("http://localhost:3000/api/session", { headers: { Cookie: `${SESSION_COOKIE_NAME}=${jar.cookie(SESSION_COOKIE_NAME)}` } }));
    expect(staleGet.status).toBe(200);
    expect(((await staleGet.json()) as { claims: { uid: string } }).claims.uid).toBe(a.uid);

    // The mocked network: only /api/session is reachable, served by the REAL
    // route handlers through the jar. Any other fetch fails the test.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: unknown, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      const u = String(url);
      if (u !== "/api/session") throw new Error(`unexpected fetch: ${u}`);
      const method = init?.method ?? "GET";
      h.fetchLog.push(method);
      if (method === "POST" && init?.body) h.postTokens.push((JSON.parse(init.body) as { idToken: string }).idToken);
      const headers: Record<string, string> = { ...(init?.headers ?? {}) };
      const c = jar.cookie(SESSION_COOKIE_NAME);
      if (c) headers["Cookie"] = `${SESSION_COOKIE_NAME}=${c}`;
      const req = new NextRequest(`http://localhost:3000${u}`, { method, headers, body: init?.body ?? null });
      const res = method === "POST" ? await POST(req) : method === "GET" ? await GET(req) : null;
      if (!res) throw new Error(`unexpected method: ${method}`);
      jar.apply(res);
      return res;
    }) as typeof fetch;

    const userB = {
      uid: b.uid,
      emailVerified: true,
      getIdToken: async () => b.idToken,
      getIdTokenResult: async () => ({ claims: { role: "admin", tenantId: "race-tenant", studioId: null } }),
    };
    function Consumer() {
      const v = useAdminAuth();
      h.states.push({ loading: v.loading, uid: (v.claims as { uid?: string } | null)?.uid ?? null });
      return null;
    }

    let el!: ReturnType<typeof create>;
    try {
      await act(async () => { el = create(createElement(AdminAuthProvider, null, createElement(Consumer))); });
      await act(async () => { h.tokenCb?.(userB); });
      // The heal chain makes REAL Auth-emulator REST calls (verify + re-exchange):
      // poll with real time until the provider settles, not fixed microtask flushes.
      for (let i = 0; i < 200 && h.states[h.states.length - 1]?.loading !== false; i++) {
        await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
      }

      // READY with B - and no A claims were ever published at any point.
      const last = h.states[h.states.length - 1]!;
      expect(last).toEqual({ loading: false, uid: b.uid });
      expect(h.states.some((s) => s.uid === a.uid)).toBe(false);
      // The heal path: stale GET first, then the re-exchange POST carrying B's token.
      expect(h.fetchLog.slice(0, 2)).toEqual(["GET", "POST"]);
      expect(h.postTokens).toEqual([b.idToken]);
      // The jar now holds B's cookie: subsequent verification answers for B.
      expect(jar.cookie(SESSION_COOKIE_NAME)).toBe(cookieB);
      const healedGet = await GET(new NextRequest("http://localhost:3000/api/session", { headers: { Cookie: `${SESSION_COOKIE_NAME}=${jar.cookie(SESSION_COOKIE_NAME)}` } }));
      expect(((await healedGet.json()) as { claims: { uid: string } }).claims.uid).toBe(b.uid);
    } finally {
      globalThis.fetch = realFetch;
      if (el!) await act(async () => { el.unmount(); });
    }
  });
});
