import { customerServiceName } from "@autodeck/core";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service, PriceSnapshot, StudioConfig } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { calculatePriceSchema } from "../../schemas/service.js";
import { calculatePrice, taxFor } from "../../lib/pricing.js";
import { addExtrasToBreakdown, extrasProblem, priceExtras, totalMinutes } from "../../lib/booking-lines.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

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
export const calculateServicePrice = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
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

  if (service.customerMenu?.priceMode==='inspection')throw new HttpsError('failed-precondition','Studio inspection required before pricing.');
  if (!service.active || service.catalogueEntryKind==='enquiry') {
    throw new HttpsError("failed-precondition", "Service is not currently available.");
  }

  // With a studio, price with that studio's tax and currency, exactly as createBooking does.
  let studio: StudioConfig | null = null;
  if (data.studioId) {
    const cfg = (await db.collection(COLLECTIONS.studioConfig()).doc(data.studioId).get()).data() as StudioConfig | undefined;
    if (!cfg) throw new HttpsError("not-found", "Studio not found.");
    assertTenant(user, cfg.tenantId);
    studio = cfg;
  }
  const tax = taxFor(studio);
  const currency = studio ? studio.currency : service.currency;
  const primary = calculatePrice({
    basePrice: service.basePrice,
    serviceCategory: service.category,
    vehicleCategory: data.vehicleCategory,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    currency,
    ...tax,
  });
  // A multi-service booking (including services needing different bay types) is priced as ONE booking with the same
  // helpers createBooking uses: the same combination rules, priceExtras and addExtrasToBreakdown. Membership, gift,
  // quote and transport options are chosen later at confirmation and are not part of this preview.
  let breakdown = primary;
  let durationMinutes = service.estimatedDurationMinutes;
  if (data.extraServiceIds?.length) {
    const extraSnaps = await Promise.all(data.extraServiceIds.map((id) => db.collection(COLLECTIONS.services()).doc(id).get()));
    if (extraSnaps.some((x) => !x.exists)) throw new HttpsError("not-found", "Service not found.");
    const extras = extraSnaps.map((x) => ({ ...(x.data() as Service), id: x.id }));
    for (const e of extras) assertTenant(user, e.tenantId);
    const problem = extrasProblem({ ...service, id: snap.id }, extras, { gift: false });
    if (problem) throw new HttpsError("failed-precondition", problem);
    const lines = priceExtras(extras, { vehicleCategory: data.vehicleCategory, tax, currency });
    breakdown = addExtrasToBreakdown(primary, lines);
    durationMinutes = totalMinutes(service.estimatedDurationMinutes, lines);
  }

  // PriceSnapshot — immutable record of this calculation; written into bookings at creation.
  const snapshot: PriceSnapshot = {
    serviceId: service.id,
    serviceName: customerServiceName(service.name),
    serviceCategory: service.category,
    vehicleCategory: data.vehicleCategory,
    basePrice: primary.basePrice,
    vehicleCategoryAdjustment: primary.scopeAdjustment,
    subtotal: primary.subtotal,
    taxRatePercent: primary.taxRatePercent,
    taxDescription: primary.taxDescription,
    tax: primary.tax,
    total: primary.total,
    currency: primary.currency,
    snapshotAt: new Date().toISOString(),
  };

  // breakdown = the whole booking; snapshot = the main service alone (unchanged meaning).
  return { breakdown, snapshot, ...(data.extraServiceIds?.length ? { durationMinutes } : {}) };
});
