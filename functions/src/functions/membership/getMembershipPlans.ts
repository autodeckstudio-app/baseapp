import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { MembershipPlan } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertTenant } from "../../middleware/auth.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

// Customers/studio browse active plans only; admin sees the full catalogue
// (including inactive plans) to manage it.
export const getMembershipPlans = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertTenant(user, user.claims.tenantId);
  await enforceRateLimit(subjectFrom(user), "read.membershipPlans");

  const db = getFirestore();
  const isAdmin = user.claims.role === "admin" || user.claims.role === "superadmin";

  let query = db
    .collection(COLLECTIONS.membershipPlans())
    .where("tenantId", "==", user.claims.tenantId);

  if (!isAdmin) {
    query = query.where("active", "==", true) as typeof query;
  }

  const snap = await query.get();
  const plans = snap.docs.map((doc) => doc.data() as MembershipPlan);

  return { plans };
});
