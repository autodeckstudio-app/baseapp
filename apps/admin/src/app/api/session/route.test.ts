// Unit contract for /api/session response binding: every response that
// returns claims MUST bind them to the verified principal (uid) - claims
// without a uid prove nothing about which account they belong to, and the
// client relies on this to reject a cookie minted for another account.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const admin = vi.hoisted(() => ({
  verifySessionCookie: vi.fn(),
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(async () => "session-cookie-value"),
}));
vi.mock("../../../lib/firebase-admin", () => ({ getAdminAuth: () => admin }));

import { GET, POST, SESSION_COOKIE_NAME } from "./route";

const decoded = { uid: "u1", email_verified: true, role: "admin", tenantId: "t", studioId: null };

beforeEach(() => {
  admin.verifySessionCookie.mockReset();
  admin.verifyIdToken.mockReset();
  admin.createSessionCookie.mockClear();
});

describe("/api/session uid binding", () => {
  it("GET returns the role scope AND the verified uid from the session cookie", async () => {
    admin.verifySessionCookie.mockResolvedValue(decoded);
    const req = new NextRequest("http://localhost/api/session", { headers: { cookie: `${SESSION_COOKIE_NAME}=abc` } });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { claims: Record<string, unknown> };
    expect(body.claims).toMatchObject({ uid: "u1", role: "admin", tenantId: "t", studioId: null });
  });

  it("POST returns the role scope AND the uid of the exchanged ID token", async () => {
    admin.verifyIdToken.mockResolvedValue(decoded);
    const req = new NextRequest("http://localhost/api/session", { method: "POST", body: JSON.stringify({ idToken: "tok" }) });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { claims: Record<string, unknown> };
    expect(body.claims).toMatchObject({ uid: "u1", role: "admin", tenantId: "t" });
  });

  it("GET with a different cookie uid returns THAT uid - never a guessed or missing principal", async () => {
    admin.verifySessionCookie.mockResolvedValue({ ...decoded, uid: "u9", role: "admin", studioId: null });
    const req = new NextRequest("http://localhost/api/session", { headers: { cookie: `${SESSION_COOKIE_NAME}=abc` } });
    const res = await GET(req);
    const body = (await res.json()) as { claims: Record<string, unknown> };
    expect(body.claims.uid).toBe("u9");
  });

  it("unverifiable cookies and non-staff claims stay rejected (no uid, no claims)", async () => {
    admin.verifySessionCookie.mockRejectedValue(new Error("bad cookie"));
    const req = new NextRequest("http://localhost/api/session", { headers: { cookie: `${SESSION_COOKIE_NAME}=abc` } });
    expect((await GET(req)).status).toBe(401);
    admin.verifySessionCookie.mockResolvedValue({ ...decoded, role: "customer" });
    expect((await GET(req)).status).toBe(403);
  });
});

it('Studio role cannot mint or resume any Admin session, without revoking its Studio credentials',async()=>{admin.verifyIdToken.mockResolvedValue({...decoded,role:'studio',studioId:'s1'});const req=new NextRequest('http://localhost/api/session',{method:'POST',body:JSON.stringify({idToken:'tok'})});expect((await POST(req)).status).toBe(403);expect(admin.createSessionCookie).not.toHaveBeenCalled();admin.verifySessionCookie.mockResolvedValue({...decoded,role:'studio',studioId:'s1'});expect((await GET(new NextRequest('http://localhost/api/session',{headers:{cookie:`${SESSION_COOKIE_NAME}=old`}}))).status).toBe(403)});
