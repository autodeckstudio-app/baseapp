import { onCall } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import { extractUser, assertRole } from "../middleware/auth.js";

/**
 * Admin-only smoke test. Verifies the deployed function and Firestore are
 * both reachable and writable — useful after a deploy or when debugging
 * connectivity, called manually by an admin (no automated caller exists
 * anywhere in this codebase today).
 *
 * Phase 5B P1-13 hardening review (Batch 4): this callable previously had
 * NO auth check at all — request.auth was never read — despite two
 * independent pieces of documentation assuming otherwise: its own comment
 * ("not exposed in production", which was also false — it's exported
 * unconditionally from index.ts) and rateLimit.ts's Phase 3D HANDOFF
 * comment, which groups "health" into the same rate-limit-exempt bucket as
 * expireStaleApprovals/expireStaleMemberships specifically BECAUSE
 * "unauthenticated requests are already rejected by extractUser before any
 * rate-limit code runs" — an assumption that was never actually true for
 * this function. Restoring the assertRole("admin","superadmin") check here
 * (matching those same two ops-utility callables exactly) makes that
 * assumption correct again, so no rate limit is added — consistent with
 * the existing documented LOW-tier exemption, not a new gap.
 */
export const healthCheck = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    assertRole(user, "admin", "superadmin");

    const db = getFirestore();
    await db.collection("_health").doc("ping").set({ ts: new Date().toISOString() });
    return { status: "ok", region: "asia-south1" };
  },
);
