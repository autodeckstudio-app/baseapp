import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { assertTenant } from "../../middleware/auth.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getServiceCatalogueSchema } from "../../schemas/service.js";

export const getServiceCatalogue = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  // Any authenticated user of the correct tenant can browse the catalogue
  assertTenant(user, user.claims.tenantId);

  const data = validate(getServiceCatalogueSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "read.catalogue");

  const db = getFirestore();
  let query = db
    .collection(COLLECTIONS.services())
    .where("tenantId", "==", user.claims.tenantId)
    .where("active", "==", true)
    .orderBy("displayOrder", "asc");

  if (data.category !== undefined) {
    query = query.where("category", "==", data.category) as typeof query;
  }

  const snap = await query.get();
  const services = snap.docs.map((doc) => doc.data() as Service);

  return { services };
});
