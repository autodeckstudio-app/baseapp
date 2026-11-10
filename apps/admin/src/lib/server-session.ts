// Server-only helpers shared by the admin Route Handlers.
import type { NextRequest } from "next/server";
import type { AutoDeckClaims, AuthorizedUser } from "@autodeck/auth";
import { getAdminAuth } from "./firebase-admin";

export const SESSION_COOKIE_NAME = "__session";

// Studio credentials stay valid for the separate floor app, never an Admin-host session.
export const ADMIN_APP_ROLES = new Set(["admin", "superadmin", "accountant"]);

export function extractClaims(decoded: Record<string, unknown>): AutoDeckClaims | null {
  const role = typeof decoded["role"] === "string" ? decoded["role"] : null;
  const tenantId = typeof decoded["tenantId"] === "string" ? decoded["tenantId"] : null;
  if (!role || !ADMIN_APP_ROLES.has(role) || !tenantId) return null;
  const studioId = typeof decoded["studioId"] === "string" ? decoded["studioId"] : null;
  return { role: role as AutoDeckClaims["role"], tenantId, studioId };
}

// Verifies the httpOnly session cookie (signature, expiry, revocation) and
// returns the caller when their role is one of `roles`.
export async function requireSession(
  request: NextRequest,
  roles: AutoDeckClaims["role"][],
): Promise<AuthorizedUser | null> {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    const claims = extractClaims(decoded);
    if (!claims || !roles.includes(claims.role)) return null;
    return {
      uid: decoded.uid,
      phone: typeof decoded.phone_number === "string" ? decoded.phone_number : null,
      email: typeof decoded.email === "string" ? decoded.email : null,
      claims,
    };
  } catch {
    return null;
  }
}
