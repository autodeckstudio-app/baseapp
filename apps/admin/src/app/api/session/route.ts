// Phase 5B P1-15: server session-cookie exchange. Route Handlers run in the
// Node.js runtime by default (unlike middleware, which defaults to Edge and
// cannot load firebase-admin — see ../../../middleware.ts), so this is
// where the actual cryptographic verification of the admin session lives.
//
// This does NOT replace or weaken the existing callable/Firestore-rules
// authorization model: the Firebase ID token the browser's Firebase Auth
// SDK holds is still what authenticates every direct Firestore read and
// every httpsCallable invocation — Firebase provides no alternative for
// those (a session cookie is not something Firestore rules or Cloud
// Functions understand). What changes is what gates the admin APP/PAGES
// being reachable at all: previously that was purely a client-side check
// of the Firebase Auth SDK's local (IndexedDB-backed) auth state, which is
// UI-only — nothing stopped a script from reaching the app shell or, more
// importantly, nothing revoked that "logged in" client state server-side.
// Now page access is gated by an httpOnly, non-JS-readable, explicitly
// expiring, server-verified, revocable session cookie instead.
import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth } from "../../../lib/firebase-admin";
import { SESSION_COOKIE_NAME, extractClaims } from "../../../lib/server-session";

export { SESSION_COOKIE_NAME };

// 12 hours: short enough for a financial-operations admin tool, long enough
// not to force re-login mid-shift. Within Firebase's allowed [5min, 2weeks]
// createSessionCookie range.
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Role gate lives in lib/server-session.ts (ADMIN_APP_ROLES / extractClaims):
// admin + superadmin get the full app; studio staff get a session that the
// (admin) layout confines to the Studio floor, and every office API route
// still requires admin.

function setSessionCookie(response: NextResponse, sessionCookie: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionCookie,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
  });
}

function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

// Exchanges a fresh Firebase ID token (just obtained via the client SDK's
// Google sign-in, after /api/auth/resolve-claims) for an httpOnly session cookie. Rejects
// non-admin roles server-side — previously this check only existed
// client-side in auth-context.tsx, trivially bypassable by anyone able to
// run JS against the page.
export async function POST(request: NextRequest): Promise<NextResponse> {
  let idToken: unknown;
  try {
    const body = (await request.json()) as { idToken?: unknown };
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "invalid-token" }, { status: 401 });
  }
  // Same requirement as the role resolver: no staff session on an
  // unverified email.
  if (decoded.email_verified !== true) {
    return NextResponse.json({ error: "email-not-verified" }, { status: 403 });
  }

  const claims = extractClaims(decoded);
  if (!claims) {
    return NextResponse.json({ error: "not-admin" }, { status: 403 });
  }

  let sessionCookie: string;
  try {
    sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });
  } catch {
    return NextResponse.json(
      { error: "session-create-failed" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ claims });
  setSessionCookie(response, sessionCookie);
  return response;
}

// Authoritative session check — called by AdminAuthProvider on mount and
// whenever the client SDK's auth state changes. Verifies the httpOnly
// cookie's signature, expiry, AND revocation status (checkRevoked: true),
// so a logged-out-elsewhere or admin-revoked session actually stops
// working here, not just visually in the tab that issued the logout.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) {
    return NextResponse.json({ error: "no-session" }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifySessionCookie(cookie, true);
  } catch {
    return NextResponse.json({ error: "invalid-session" }, { status: 401 });
  }

  const claims = extractClaims(decoded);
  if (!claims) {
    return NextResponse.json({ error: "not-admin" }, { status: 403 });
  }

  return NextResponse.json({ claims });
}

// Logout: revokes the account's refresh tokens server-side (so the session
// cookie — and any other outstanding session cookie/ID-token-refresh for
// this uid — stops verifying under checkRevoked:true) and clears the
// cookie. Note this cannot instantly invalidate an already-issued Firebase
// ID token still held by the browser's Firebase Auth SDK before its natural
// ~1 hour expiry — that is a documented characteristic of Firebase's token
// model (ID tokens are verified by signature, not a revocation list, unless
// the verifier explicitly opts into checkRevoked), not a gap introduced
// here. The client is expected to also call firebaseSignOut(auth)
// immediately (see auth-context.tsx), which clears the SDK's local session
// and stops it from presenting that token again.
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie) {
    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifySessionCookie(cookie);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Already invalid/expired — nothing to revoke, still clear the cookie.
    }
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
