/**
 * Kept backend-local for Phase 1 (not moved into packages/domain — that
 * relocation, if ever wanted, is a separate future decision, not assumed
 * here).
 */
export const PERMISSION_ROLES = ['owner_admin', 'studio_manager', 'staff'] as const;
export type PermissionRole = (typeof PERMISSION_ROLES)[number];

export function isPermissionRole(value: unknown): value is PermissionRole {
  return typeof value === 'string' && (PERMISSION_ROLES as readonly string[]).includes(value);
}
