// Admin-triggerable bulk expiry sweep. Flips any 'active' membership whose
// endDate has passed to 'expired', scoped to the calling admin's own
// tenant. Preserved as a manual/operational escape hatch alongside the
// scheduled sweep (see expireStaleMembershipsScheduled.ts) â an admin who
// needs the correction applied immediately (e.g. debugging a support
// ticket) doesn't have to wait for the next scheduled run.
//
// Expiry is ALSO enforced lazily at booking time (createBooking rejects an
// active-but-past-endDate membership regardless of whether any sweep has
// run) and at read time (getMyMemberships derives the effective status via
// getEffectiveMembershipStatus) â both paths stay correct even if neither
// this callable nor the scheduled sweep ever ran. The sweep exists to keep
// the STORED status (and anything reading it directly, like admin
// dashboards) from drifting stale, not to prevent incorrect behavior.
import { onCall } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { sweepStaleMemberships, sweepStalePendingMemberships } from "../../lib/expiry-sweeps.js";

export const expireStaleMemberships = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const db = getFirestore();
  const actor = { uid: user.uid, role: user.claims.role };
  const expired = await sweepStaleMemberships(db, { tenantId: user.claims.tenantId, actor });
  const pendingCancelled = await sweepStalePendingMemberships(db, { tenantId: user.claims.tenantId, actor });
  return { ...expired, ...pendingCancelled };
});
