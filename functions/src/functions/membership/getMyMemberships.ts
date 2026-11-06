import { assertMembershipIdentityCompatible } from "../../lib/membership-identity-compat.js";
import {
  requireCustomerDocId,
  resolveCustomerDocId,
} from "../../lib/customer-identity.js";
// Returns Membership documents for a customer (current + past), powering both
// the "Current Membership" and "Membership history" screens. Customers may
// only ever read their own records; studio/admin may look up any customer
// within their tenant (e.g. to show membership status on a job).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Membership } from "@autodeck/core";
import { getEffectiveMembershipStatus } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getMyMembershipsSchema } from "../../schemas/membership.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const getMyMemberships = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    const data = validate(getMyMembershipsSchema, request.data);
    await enforceRateLimit(subjectFrom(user), "read.myMemberships");

    const isStudioOrAdmin = ["studio", "admin", "superadmin"].includes(
      user.claims.role,
    );
    const db = getFirestore();
    const ownCustomerId = !isStudioOrAdmin
      ? await requireCustomerDocId(
          db,
          COLLECTIONS.customers(),
          user.claims.tenantId,
          user.uid,
        )
      : !data.customerId
        ? ((await resolveCustomerDocId(
            db,
            COLLECTIONS.customers(),
            user.claims.tenantId,
            user.uid,
          )) ?? user.uid)
        : null;
    const customerId = isStudioOrAdmin
      ? (data.customerId ?? ownCustomerId!)
      : ownCustomerId!;

    if (
      !isStudioOrAdmin &&
      data.customerId !== undefined &&
      data.customerId !== ownCustomerId
    ) {
      throw new HttpsError(
        "permission-denied",
        "Cannot read another customer's memberships.",
      );
    }

    if (ownCustomerId && customerId === ownCustomerId)
      await assertMembershipIdentityCompatible(
        db,
        user.claims.tenantId,
        user.uid,
        ownCustomerId,
        undefined,
        true,
      );
    const snap = await db
      .collection(COLLECTIONS.memberships())
      .where("tenantId", "==", user.claims.tenantId)
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .get();

    // Display-only correction — never mutates the stored document (see
    // getEffectiveMembershipStatus doc comment). A daily scheduled sweep
    // keeps the stored status itself reasonably fresh too (see
    // expireStaleMembershipsScheduled.ts), but this stays in place as a
    // read-time guarantee that's correct even within the sweep's up-to-24h
    // staleness window, or if it hasn't run yet in a given environment.
    const memberships = snap.docs.map((doc) => {
      const membership = doc.data() as Membership;
      return {
        ...membership,
        status: getEffectiveMembershipStatus(membership),
      };
    });
    return { memberships };
  },
);
