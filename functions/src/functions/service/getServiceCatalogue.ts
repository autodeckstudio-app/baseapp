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
  const isAdmin = user.claims.role === "admin" || user.claims.role === "superadmin";
  const services = snap.docs.map((doc) => {
    const svc = doc.data() as Service;
    if (isAdmin) return svc;
    // Sources and pricing basis are admin-only; customers only learn whether a price is an estimate.
    const { internalNotes: _n, priceBasis, priceBasisAt: _a, ...rest } = svc;
    return { ...rest, priceEstimate: /estimate/i.test(priceBasis ?? "") } as Service;
  });

  return { services };
});
