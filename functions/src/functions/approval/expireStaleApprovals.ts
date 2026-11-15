// Admin-triggerable bulk expiry sweep — same pattern as
// expireStaleMemberships.ts. Scoped to the calling admin's own tenant,
// preserved as a manual/operational escape hatch alongside the scheduled
// sweep (see expireStaleApprovalsScheduled.ts).
//
// Expiry is ALSO enforced lazily inside respondToApproval, so a customer
// can never act on a stale approval regardless of whether any sweep has
// run. The sweep exists to keep the STORED status from drifting stale for
// anything reading it directly (e.g. a studio's approval queue), not to
// prevent incorrect behavior.
import { onCall } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { sweepStaleApprovals } from "../../lib/expiry-sweeps.js";

export const expireStaleApprovals = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const db = getFirestore();
  return sweepStaleApprovals(db, {
    tenantId: user.claims.tenantId,
    actor: { uid: user.uid, role: user.claims.role },
  });
});
