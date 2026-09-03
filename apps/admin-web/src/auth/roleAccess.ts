import { hasSufficientRole, type PermissionRole } from '@autodeck/domain';

/**
 * Per the approved product decisions, admin-web is "never accessible to
 * customer or Staff-role accounts" — Owner/Admin and Studio Manager only.
 * This is a UI-side navigation boundary ONLY: it decides whether to show
 * the dashboard shell or redirect to login, nothing more. It grants no
 * actual authority — every backend endpoint independently re-enforces its
 * own role requirement via `RolesGuard`/`@Roles()`, regardless of what
 * this function decides. A user who somehow reached a dashboard screen
 * without sufficient role would still have every write rejected server-side.
 */
export function canAccessAdminDashboard(role: PermissionRole): boolean {
  return hasSufficientRole(role, 'studio_manager');
}
