import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service, PriceSnapshot } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { calculatePriceSchema } from "../../schemas/service.js";
import { calculatePrice } from "../../lib/pricing.js";

// Server-authoritative price calculation.
// The client MUST call this and use the returned breakdown — it must never compute
// or submit its own final price. Pricing is frozen into a PriceSnapshot for use in bookings.
//
// Restored in Phase 3I: incorrectly deleted in Phase 3H as "zero callers" — that
// audit's grep only matched single-line `httpsCallable(functions, "name")` calls
// and missed the multi-line form used by every real caller (customer catalogue
// browsing/booking confirm/garage, studio walk-in price preview, admin service
// pricing preview). Restored verbatim plus rate limiting, which every other
// active read/preview callable already has.
export const calculateServicePrice = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertTenant(user, user.claims.tenantId);

  const data = validate(calculatePriceSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "read.calculatePrice");

  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.services()).doc(data.serviceId).get();

  if (!snap.exists) throw new HttpsError("not-found", "Service not found.");

  const service = snap.data() as Service;

  // Cross-tenant access denied — client cannot request pricing from another tenant's catalogue
  assertTenant(user, service.tenantId);

  if (!service.active) {
    throw new HttpsError("failed-precondition", "Service is not currently available.");
  }

  const breakdown = calculatePrice({
    basePrice: service.basePrice,
    vehicleCategory: data.vehicleCategory,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    currency: service.currency,
    // taxRatePercent and taxDescription use defaults (GST 18%) — tenant config is V2+
  });

  // PriceSnapshot — immutable record of this calculation; written into bookings at creation.
  const snapshot: PriceSnapshot = {
    serviceId: service.id,
    serviceName: service.name,
    serviceCategory: service.category,
    vehicleCategory: data.vehicleCategory,
    basePrice: breakdown.basePrice,
    vehicleCategoryAdjustment: breakdown.scopeAdjustment,
    subtotal: breakdown.subtotal,
    taxRatePercent: breakdown.taxRatePercent,
    taxDescription: breakdown.taxDescription,
    tax: breakdown.tax,
    total: breakdown.total,
    currency: breakdown.currency,
    snapshotAt: new Date().toISOString(),
  };

  return { breakdown, snapshot };
});
