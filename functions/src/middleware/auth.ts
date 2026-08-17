import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import type { AuthorizedUser, AutoDeckClaims, UserRole } from "@autodeck/auth";

/**
 * Extracts and validates the AutoDeck custom claims from a callable request.
 * Throws HttpsError if the token is missing or claims are invalid.
 */
export function extractUser(request: CallableRequest): AuthorizedUser {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid, token } = request.auth;
  const claims = token as unknown as AutoDeckClaims & { role?: UserRole };

  if (!claims.role || !claims.tenantId) {
    throw new HttpsError(
      "permission-denied",
      "Account setup incomplete. Contact support.",
    );
  }

  return {
    uid,
    phone: token.phone_number ?? null,
    email: token.email ?? null,
    claims: {
      role: claims.role,
      tenantId: claims.tenantId,
      studioId: claims.studioId ?? null,
    },
  };
}

/**
 * Asserts the user has one of the required roles.
 * Throws HttpsError if the check fails.
 */
export function assertRole(user: AuthorizedUser, ...roles: UserRole[]): void {
  if (!roles.includes(user.claims.role)) {
    throw new HttpsError(
      "permission-denied",
      `Role '${user.claims.role}' is not authorized for this operation.`,
    );
  }
}

/**
 * Asserts the user belongs to the specified tenant.
 * Superadmins bypass this check.
 */
export function assertTenant(user: AuthorizedUser, documentTenantId: string): void {
  if (user.claims.role === "superadmin") return;
  if (user.claims.tenantId !== documentTenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
}
