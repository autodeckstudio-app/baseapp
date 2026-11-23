import { membershipDay } from "./membership-calendar.js";
import type { Membership, MembershipStatus } from "./types/membership.js";

/**
 * Derives the membership status as it should be PRESENTED to users, without
 * mutating the stored document. A membership stored as "active" past its
 * endDate is effectively expired the moment endDate passes — there is no
 * guarantee that the scheduled sweep has already run, so every read must derive this
 * itself rather than trust the stored field.
 *
 * Last-valid dates are inclusive in IST, expiring at midnight afterward.
 * This is a display-only correction. Financial safety never depends on it:
 * every consumption path (createBooking.ts) independently re-validates
 * endDate at the moment of use regardless of the stored status, so a stale
 * "active" status cannot be exploited even before this function runs.
 */
export function getEffectiveMembershipStatus(
  membership: Pick<Membership, "status" | "endDate">,
): MembershipStatus {
  if (membership.status === "active" && membership.endDate) {
    const today = membershipDay();
    if (membership.endDate < today) return "expired";
  }
  return membership.status;
}
