/**
 * Phase 5B P1-15 regression coverage for the session-cookie exchange.
 * Run with: pnpm test:emulator (requires the Auth Emulator at localhost:9099
 * — see ../../../../test/emulator-setup.ts).
 *
 * Getting a real, emulator-verifiable Firebase ID token in a Node test (no
 * browser) uses the same technique Firebase's own docs recommend for
 * server-side emulator testing: mint a custom token via the Admin SDK, then
 * exchange it for an ID token through the Auth Emulator's Identity Toolkit
 * REST endpoint. Custom claims set via setCustomUserClaims BEFORE the
 * exchange are reflected in the resulting ID token, same as a real client
 * sign-in would see after those claims were set.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getAdminAuth } from "../../../lib/firebase-admin";

const adminAuth = getAdminAuth();
import {
  POST,
  GET,
  DELETE,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
} from "./route";

const AUTH_EMULATOR_HOST =
  process.env["FIREBASE_AUTH_EMULATOR_HOST"] ?? "localhost:9099";

async function mintIdToken(uid: string): Promise<string> {
  const customToken = await adminAuth.createCustomToken(uid);
  const res = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!res.ok)
    throw new Error(
      `custom token exchange failed: ${res.status} ${await res.text()}`,
    );
  const data = (await res.json()) as { idToken: string };
  return data.idToken;
}

async function createTestUser(
  label: string,
  role: string,
  tenantId = "session-tenant",
  opts: { studioId?: string | null; emailVerified?: boolean } = {},
): Promise<{ uid: string; idToken: string }> {
  const uid = `session-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await adminAuth.createUser({
    uid,
    email: `${uid}@example.test`,
    emailVerified: opts.emailVerified ?? true,
  });
  await adminAuth.setCustomUserClaims(uid, { role, tenantId, studioId: opts.studioId ?? null });
  const idToken = await mintIdToken(uid);
  return { uid, idToken };
}

function postRequest(idToken: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

function getRequest(cookieValue?: string): NextRequest {
  const headers: HeadersInit = cookieValue
    ? { Cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` }
    : {};
  return new NextRequest("http://localhost:3000/api/session", { headers });
}

function deleteRequest(cookieValue?: string): NextRequest {
  const headers: HeadersInit = cookieValue
    ? { Cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` }
    : {};
  return new NextRequest("http://localhost:3000/api/session", {
    method: "DELETE",
    headers,
  });
}

describe("POST /api/session", () => {
  it("rejects a missing idToken", async () => {
    const res = await POST(postRequest(undefined));
    expect(res.status).toBe(400);
  });

  it("rejects a garbage idToken string (unauthenticated caller)", async () => {
    const res = await POST(postRequest("not-a-real-token"));
    expect(res.status).toBe(401);
  });

  it("rejects a valid token belonging to a non-admin (customer) role", async () => {
    const { idToken } = await createTestUser("customer", "customer");
    const res = await POST(postRequest(idToken));
    expect(res.status).toBe(403);
  });

  it("rejects a studio-role token with no studioId (malformed staff claims)", async () => {
    const { idToken } = await createTestUser("studio", "studio");
    const res = await POST(postRequest(idToken));
    expect(res.status).toBe(403);
  });

  it("accepts studio staff scoped to a studio (Studio floor only; layout gates the rest)", async () => {
    const { idToken } = await createTestUser("studio-ok", "studio", "session-tenant", { studioId: "studio-a" });
    const res = await POST(postRequest(idToken));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { claims: { role: string; studioId: string | null } };
    expect(body.claims.role).toBe("studio");
    expect(body.claims.studioId).toBe("studio-a");
  });

  it("rejects an admin token whose email is not verified", async () => {
    const { idToken } = await createTestUser("unverified", "admin", "session-tenant", { emailVerified: false });
    const res = await POST(postRequest(idToken));
    expect(res.status).toBe(403);
  });

  it("accepts an admin and sets a correctly-flagged httpOnly session cookie", async () => {
    const { idToken } = await createTestUser(
      "admin",
      "admin",
      "cookie-flags-tenant",
    );
    const res = await POST(postRequest(idToken));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      claims: { role: string; tenantId: string };
    };
    expect(body.claims.role).toBe("admin");
    expect(body.claims.tenantId).toBe("cookie-flags-tenant");

    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();
    // httpOnly is what makes "session cannot be read by client JavaScript"
    // true — document.cookie never exposes httpOnly cookies to page JS.
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("strict");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(Math.floor(SESSION_MAX_AGE_MS / 1000));
    // `secure` is intentionally NODE_ENV-conditional (see route.ts) so it
    // isn't asserted here — this suite runs with NODE_ENV=test, not
    // "production", by design (matches the rest of this codebase's
    // production-only guards, e.g. apps/admin/src/lib/firebase.ts).
  });

  it("also accepts a superadmin", async () => {
    const { idToken } = await createTestUser("superadmin", "superadmin");
    const res = await POST(postRequest(idToken));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/session", () => {
  it("rejects when no cookie is present (unauthenticated admin route)", async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("rejects a tampered/invalid cookie value (stands in for expired — same verification-failure path)", async () => {
    const res = await GET(getRequest("this-is-not-a-valid-session-cookie"));
    expect(res.status).toBe(401);
  });

  it("accepts a cookie from a valid admin session and returns matching claims", async () => {
    const { idToken } = await createTestUser("admin2", "admin", "get-tenant");
    const postRes = await POST(postRequest(idToken));
    const sessionCookie = postRes.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(sessionCookie).toBeTruthy();

    const getRes = await GET(getRequest(sessionCookie));
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { claims: { tenantId: string } };
    expect(body.claims.tenantId).toBe("get-tenant");
  });
});

describe("DELETE /api/session — logout and revocation", () => {
  it("clears the cookie even when none was present", async () => {
    const res = await DELETE(deleteRequest());
    expect(res.status).toBe(200);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("");
  });

  it("revokes the session: a session cookie issued before logout stops working after it", async () => {
    const { idToken } = await createTestUser(
      "admin3",
      "admin",
      "revoke-tenant",
    );
    const postRes = await POST(postRequest(idToken));
    const sessionCookie = postRes.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(sessionCookie).toBeTruthy();

    const preLogout = await GET(getRequest(sessionCookie));
    expect(preLogout.status).toBe(200);

    // revokeRefreshTokens' validSince cutoff is truncated to whole seconds,
    // and checkRevoked's comparison is a strict `iat < validSince` — a
    // token minted in the same wall-clock second as the revocation can
    // legitimately slip through (documented Firebase behavior, not a gap
    // in this implementation). A real login-then-logout is never this
    // fast; this delay only compensates for the test itself running faster
    // than a human ever would.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const deleteRes = await DELETE(deleteRequest(sessionCookie));
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("");

    // The old cookie must now fail GET's checkRevoked:true verification —
    // "revoked sessions must stop working" requirement.
    const postLogout = await GET(getRequest(sessionCookie));
    expect(postLogout.status).toBe(401);
  });
});
