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

/**
 * A strict hierarchy, matching the approved capability matrix exactly:
 * everything Staff can do, Studio Manager can also do; everything Studio
 * Manager can do, Owner/Admin can also do. Single source of truth — used
 * by RolesGuard for the coarse per-endpoint minimum-role check, and by
 * staff-management logic for the finer target-role checks below.
 */
export const ROLE_RANK: Record<PermissionRole, number> = {
  staff: 0,
  studio_manager: 1,
  owner_admin: 2,
};

export function hasSufficientRole(actual: PermissionRole, minimumRequired: PermissionRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[minimumRequired];
}

/**
 * Whether `actorRole` is authorized to create, role-change, or otherwise
 * act upon an account whose role is (or would become) `targetRole`.
 *
 * The approved specification is explicit that Studio Manager "cannot
 * create/change Owner/Admin accounts." It does not explicitly say whether
 * Studio Manager may act on OTHER Studio-Manager-tier accounts. This is
 * resolved conservatively (least privilege): only Owner/Admin may create,
 * role-change, or deactivate anything at the Studio Manager or Owner/Admin
 * tier. Studio Manager may only act on Staff-tier accounts.
 */
export function canManageTargetRole(actorRole: PermissionRole, targetRole: PermissionRole): boolean {
  if (targetRole === 'staff') {
    return hasSufficientRole(actorRole, 'studio_manager');
  }
  return actorRole === 'owner_admin';
}
