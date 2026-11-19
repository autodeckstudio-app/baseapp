import type { Membership, Service } from "@autodeck/core";

/**
 * Whether a membership's included washes cover this service.
 *
 * Owner-approved ladder (18 Nov 2026, kept 19 Nov): all membership washes are
 * Regular Wash. New plans carry an explicit washServiceIds binding that is
 * snapshotted onto the Membership at purchase; when the snapshot is present
 * it alone decides coverage. That keeps a purchased entitlement stable under
 * later global service-flag edits, and keeps legacy wash-eligible services
 * (e.g. Wash & Wax) outside the new ladder WITHOUT changing their flags, so
 * memberships bought before the binding existed behave exactly as before
 * (missing washServiceIds = global membershipWashEligible decides).
 */
export function membershipCoversWashService(
  service: Pick<Service, "id" | "membershipWashEligible">,
  membership: Pick<Membership, "washServiceIds">,
): boolean {
  if (membership.washServiceIds !== undefined) {
    // Fail closed on a malformed binding (present but not an array): cover
    // nothing rather than throw inside a booking/settlement transaction.
    return Array.isArray(membership.washServiceIds) && membership.washServiceIds.includes(service.id);
  }
  return service.membershipWashEligible === true;
}
