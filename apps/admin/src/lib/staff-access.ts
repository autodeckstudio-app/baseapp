// Studio / Office gating for the admin shell. Pure so it can be unit tested.
//
// STUDIO = run today's work (bookings and the job floor). Staff live here.
// OFFICE = run the business: money, catalogue, customers, staff, settings.
// Admins see both. Studio staff see only Studio routes; anything else sends
// them back to the Studio floor. Firestore rules and every callable/API
// route keep their own server-side checks - this is navigation, not the
// security boundary.
import type { UserRole } from "@autodeck/auth";

export const STUDIO_HOME = "/jobs";
export const OFFICE_HOME = "/dashboard";

export const STUDIO_PATHS = ["/jobs", "/bookings", "/attendance", "/gallery"] as const;

export function isStudioPath(pathname: string): boolean {
  return STUDIO_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function canSeeOffice(role: UserRole | undefined | null): boolean {
  return role === "admin" || role === "superadmin";
}

export const ACCOUNTANT_HOME = "/accountant";

// The accountant role is read-only Money and sees exactly one route. It never sees Office or Studio screens.
export function isAccountantPath(pathname: string): boolean {
  return pathname === ACCOUNTANT_HOME || pathname.startsWith(`${ACCOUNTANT_HOME}/`);
}

export function canVisit(role: UserRole | undefined | null, pathname: string): boolean {
  if (role === "accountant") return isAccountantPath(pathname);
  if (canSeeOffice(role)) return true;
  return role === "studio" && isStudioPath(pathname);
}

export function homeFor(role: UserRole | undefined | null): string {
  if (role === "accountant") return ACCOUNTANT_HOME;
  return canSeeOffice(role) ? OFFICE_HOME : STUDIO_HOME;
}
