import { assertMembershipIdentityCompatible } from "../../lib/membership-identity-compat.js";
import { requireCustomerDocId } from "../../lib/customer-identity.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Membership, MembershipUsage } from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import { extractUser, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getMembershipUsageSchema } from "../../schemas/membership.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const getMembershipUsage = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    const data = validate(getMembershipUsageSchema, request.data);
    await enforceRateLimit(subjectFrom(user), "read.membershipUsage");

    const db = getFirestore();
    const membershipSnap = await db
      .collection(COLLECTIONS.memberships())
      .doc(data.membershipId)
      .get();
    if (!membershipSnap.exists)
      throw new HttpsError("not-found", "Membership not found.");

    const membership = membershipSnap.data() as Membership;
    assertTenant(user, membership.tenantId);

    const isStudioOrAdmin = ["studio", "admin", "superadmin"].includes(
      user.claims.role,
    );
    const customerId = !isStudioOrAdmin
      ? await requireCustomerDocId(
          db,
          COLLECTIONS.customers(),
          user.claims.tenantId,
          user.uid,
        )
      : null;
    if (
      !isStudioOrAdmin &&
      membership.customerId === user.uid &&
      customerId !== user.uid
    )
      await assertMembershipIdentityCompatible(
        db,
        user.claims.tenantId,
        user.uid,
        customerId!,
        undefined,
        true,
      );
    if (!isStudioOrAdmin && membership.customerId !== customerId) {
      throw new HttpsError(
        "permission-denied",
        "Cannot read another customer's membership usage.",
      );
    }

    const snap = await db
      .collection(SUBCOLLECTIONS.membershipUsage(data.membershipId))
      .orderBy("usedAt", "desc")
      .get();

    const usage = snap.docs.map((doc) => doc.data() as MembershipUsage);
    return { usage };
  },
);
