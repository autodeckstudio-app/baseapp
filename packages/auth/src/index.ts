export type { AutoDeckClaims, AuthorizedUser, PermissionResult, UserRole } from "./types.js";
export {
  requireRole,
  requireSameTenant,
  requireSameStudio,
  requireOwnership,
} from "./permissions.js";
