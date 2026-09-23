export type UserRole = "customer" | "studio" | "admin" | "superadmin";

/**
 * Firebase custom claims — embedded in the ID token.
 * Set only server-side with the Admin SDK (Cloud Functions, or the admin
 * app's Route Handlers). Never from client.
 */
export interface AutoDeckClaims {
  role: UserRole;
  tenantId: string;
  studioId: string | null; // only for studio-scoped staff
}

export type AuthorizedUser = {
  uid: string;
  phone: string | null;
  email: string | null;
  claims: AutoDeckClaims;
};

export type PermissionResult =
  | { allowed: true }
  | { allowed: false; reason: string };
