/**
 * Mirrors `apps/backend/src/auth/role.type.ts` exactly (role values and
 * hierarchy). That file's own comment explicitly deferred moving this into
 * a shared package as "a separate future decision, not assumed here" —
 * Phase 3A (frontend apps needing to read a user's role from their Firebase
 * ID token) is that decision point. The backend's own file is untouched
 * and remains its own independent source of truth for backend
 * authorization; this export exists for FRONTEND consumption only (session
 * state, navigation, showing/hiding UI) — it grants no authority of its
 * own. The backend never trusts anything the client computes with it.
 */
export const PERMISSION_ROLES = ['owner_admin', 'studio_manager', 'staff'] as const;
export type PermissionRole = (typeof PERMISSION_ROLES)[number];

export function isPermissionRole(value: unknown): value is PermissionRole {
  return typeof value === 'string' && (PERMISSION_ROLES as readonly string[]).includes(value);
}

/** Same hierarchy as the backend's `ROLE_RANK`: everything Staff can do,
 * Studio Manager can also do; everything Studio Manager can do, Owner/Admin
 * can also do. */
export const ROLE_RANK: Record<PermissionRole, number> = {
  staff: 0,
  studio_manager: 1,
  owner_admin: 2,
};

export function hasSufficientRole(actual: PermissionRole, minimumRequired: PermissionRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[minimumRequired];
}
