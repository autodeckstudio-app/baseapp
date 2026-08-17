// Returns Membership documents for a customer (current + past), powering both
// the "Current Membership" and "Membership history" screens. Customers may
// only ever read their own records; studio/admin may look up any customer
// within their tenant (e.g. to show membership status on a job).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Membership } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getMyMembershipsSchema } from "../../schemas/membership.js";

export const getMyMemberships = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(getMyMembershipsSchema, request.data);

  const isStudioOrAdmin = ["studio", "admin", "superadmin"].includes(user.claims.role);
  const customerId = isStudioOrAdmin ? (data.customerId ?? user.uid) : user.uid;

  if (!isStudioOrAdmin && data.customerId !== undefined && data.customerId !== user.uid) {
    throw new HttpsError("permission-denied", "Cannot read another customer's memberships.");
  }

  const db = getFirestore();
  const snap = await db
    .collection(COLLECTIONS.memberships())
    .where("tenantId", "==", user.claims.tenantId)
    .where("customerId", "==", customerId)
    .orderBy("createdAt", "desc")
    .get();

  const memberships = snap.docs.map((doc) => doc.data() as Membership);
  return { memberships };
});
