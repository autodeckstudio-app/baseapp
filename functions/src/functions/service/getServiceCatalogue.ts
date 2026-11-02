import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { assertTenant } from "../../middleware/auth.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getServiceCatalogueSchema } from "../../schemas/service.js";
import { calculatePrice, taxFor } from "../../lib/pricing.js";
import { isSizePriced } from "@autodeck/core";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const getServiceCatalogue = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
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

  // Display totals for list tiles, computed with the same engine bookings use while the
  // documents are already loaded. Replaces one calculateServicePrice round trip per visible
  // service on car-size selection. Booking confirm still prices server-side at write time.
  let displayTotals: Record<string, number> | undefined;
  if (data.vehicleCategory !== undefined) {
    displayTotals = {};
    for (const svc of services) {
      if (svc.priceOnRequest === true) continue;
      // A size-priced service whose document lacks this size's pricing row must not present
      // its flat base as if it were the size-adjusted price: omit the display total so the
      // tile falls back to "From <base>". Booking math is untouched (separate review).
      if (isSizePriced(svc.category) && !(svc.vehicleCategoryPricing ?? []).some((r) => r.vehicleCategory === data.vehicleCategory)) continue;
      const breakdown = calculatePrice({
        basePrice: svc.basePrice,
        serviceCategory: svc.category,
        vehicleCategory: data.vehicleCategory,
        vehicleCategoryPricing: svc.vehicleCategoryPricing ?? [],
        currency: svc.currency,
        ...taxFor(null),
      });
      displayTotals[svc.id] = breakdown.total;
    }
  }

  return displayTotals === undefined ? { services } : { services, displayTotals };
});
