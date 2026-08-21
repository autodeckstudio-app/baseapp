import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import type { AuthorizedUser, AutoDeckClaims, UserRole } from "@autodeck/auth";

/**
 * Extracts the raw authenticated user from a callable request.
 * Does NOT require custom claims — used for setup functions (e.g. setupCustomerProfile)
 * where the user is authenticated but claims may not be set yet.
 */
export function extractRawAuth(
  request: CallableRequest,
): { uid: string; phone: string | null; email: string | null } {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  return {
    uid: request.auth.uid,
    phone: (request.auth.token.phone_number as string | undefined) ?? null,
    email: (request.auth.token.email as string | undefined) ?? null,
  };
}

/**
 * Extracts and validates the AutoDeck custom claims from a callable request.
 * Throws HttpsError if the token is missing or claims are not yet set.
 * Use extractRawAuth instead for functions that run before claims are established.
 */
export function extractUser(request: CallableRequest): AuthorizedUser {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid, token } = request.auth;
  const rawClaims = token as Record<string, unknown>;

  if (
    typeof rawClaims["role"] !== "string" ||
    typeof rawClaims["tenantId"] !== "string"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Account setup incomplete. Sign in again after profile setup.",
    );
  }

  const claims: AutoDeckClaims = {
    role: rawClaims["role"] as UserRole,
    tenantId: rawClaims["tenantId"] as string,
    studioId:
      typeof rawClaims["studioId"] === "string" ? rawClaims["studioId"] : null,
  };

  return {
    uid,
    phone: (token.phone_number as string | undefined) ?? null,
    email: (token.email as string | undefined) ?? null,
    claims,
  };
}

/**
 * Asserts the user has one of the required roles.
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
 */
export function assertTenant(user: AuthorizedUser, documentTenantId: string): void {
  if (user.claims.role === "superadmin") return;
  if (user.claims.tenantId !== documentTenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
}

/**
 * Asserts a studio-role caller belongs to the same studio as the document
 * being accessed. Admin/superadmin are never studio-scoped (doc19's role
 * model — admin has tenant-wide access) and always pass; customer
 * authorization is a separate, ownership-based concern and is never checked
 * here (Phase 5B P1-14 — centralizes the
 * `user.claims.role === "studio" && user.claims.studioId !== doc.studioId`
 * check already hand-rolled correctly in assignBay/getStudioJobs/
 * createWalkinJob/advanceJobStatus/createApproval/cancelApproval/
 * startInspection/updateInspection/finalizeInspection/confirmManualPayment
 * — new studio-scoped callables should use this instead of re-deriving it).
 */
export function assertStudio(user: AuthorizedUser, documentStudioId: string, entityLabel = "Resource"): void {
  if (user.claims.role !== "studio") return;
  if (user.claims.studioId !== documentStudioId) {
    throw new HttpsError("permission-denied", `${entityLabel} belongs to a different studio.`);
  }
}
