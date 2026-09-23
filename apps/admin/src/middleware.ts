// Phase 5B P1-15: first line of defense for admin page access. Next.js
// middleware defaults to the Edge runtime, which cannot load firebase-admin
// (Node-only APIs / gRPC bindings) — so this can only check that a session
// cookie is PRESENT, not cryptographically verify its signature, expiry, or
// revocation status. Real verification happens in /api/session's GET
// handler (Node.js runtime), which AdminAuthProvider calls as the
// authoritative check on every mount — see src/lib/auth-context.tsx.
//
// This still closes a real gap: previously there was no server-side gating
// of any kind — every /(admin) page was a "use client" component that
// rendered blank/redirected only after React hydrated and Firebase Auth's
// client SDK resolved its local state. A request with no session cookie at
// all is now redirected before any page code runs.
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "__session";

export function middleware(request: NextRequest): NextResponse {
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

// Excludes /login (must stay reachable to actually sign in), /design (the
// static theme reference - tokens and primitives only, no data), /api (session
// exchange endpoints must stay reachable pre-cookie), and Next internals.
export const config = {
  matcher: ["/((?!login|design|api|_next/static|_next/image|favicon.ico).*)"],
};
