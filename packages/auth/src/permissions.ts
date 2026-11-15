import type { AuthorizedUser, PermissionResult, UserRole } from "./types.js";

export function requireRole(
  user: AuthorizedUser,
  ...allowedRoles: UserRole[]
): PermissionResult {
  if (allowedRoles.includes(user.claims.role)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Role '${user.claims.role}' is not authorized. Required: ${allowedRoles.join(" | ")}`,
  };
}

export function requireSameTenant(
  user: AuthorizedUser,
  documentTenantId: string,
): PermissionResult {
  if (user.claims.role === "superadmin") return { allowed: true };
  if (user.claims.tenantId === documentTenantId) return { allowed: true };
  return {
    allowed: false,
    reason: `Tenant mismatch: token has '${user.claims.tenantId}', document has '${documentTenantId}'`,
  };
}

export function requireSameStudio(
  user: AuthorizedUser,
  documentStudioId: string,
): PermissionResult {
  if (user.claims.role === "superadmin" || user.claims.role === "admin") {
    return { allowed: true };
  }
  if (user.claims.studioId === documentStudioId) return { allowed: true };
  return {
    allowed: false,
    reason: `Studio mismatch: token has '${user.claims.studioId ?? "null"}', document has '${documentStudioId}'`,
  };
}

export function requireOwnership(
  user: AuthorizedUser,
  documentOwnerId: string,
): PermissionResult {
  if (user.claims.role === "admin" || user.claims.role === "superadmin") {
    return { allowed: true };
  }
  if (user.uid === documentOwnerId) return { allowed: true };
  return { allowed: false, reason: "Access denied: not the owner of this resource" };
}
