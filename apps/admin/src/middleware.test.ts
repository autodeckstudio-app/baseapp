import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function requestTo(path: string, cookieHeader?: string): NextRequest {
  const headers: HeadersInit = cookieHeader ? { Cookie: cookieHeader } : {};
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

describe("middleware — session cookie presence gate", () => {
  it("redirects to /login when no session cookie is present", () => {
    const res = middleware(requestTo("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("passes through when a session cookie is present (does not verify it — that's /api/session's job)", () => {
    const res = middleware(requestTo("/dashboard", "__session=some-opaque-value"));
    // NextResponse.next() carries no redirect location and a middleware
    // "pass-through" marker header rather than a 3xx status.
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects a cookie-less request to any matched admin path, not just /dashboard", () => {
    const res = middleware(requestTo("/staff"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
