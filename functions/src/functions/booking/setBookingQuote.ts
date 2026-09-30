// Admin/studio: set the price on a price-on-request booking. requested -> quoted.
// Recomputes the booking price snapshot from the quoted base price; the service template stays unpriced.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Booking, StudioConfig } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { calculatePrice } from "../../lib/pricing.js";

const schema = z.object({
  bookingId: z.string().min(1),
  basePricePaise: z.number().int().min(1),
}).strict();

export const setBookingQuote = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(schema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.quote");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
    const b = snap.data() as Booking;
    assertTenant(user, b.tenantId);
    if (b.priceOnRequest !== true) throw new HttpsError("failed-precondition", "This booking has a fixed price.");
    if (b.quoteStatus === "approved") throw new HttpsError("failed-precondition", "The customer already approved a quote.");
    const cfgSnap = await tx.get(db.collection(COLLECTIONS.studioConfig()).doc(b.studioId));
    const cfg = cfgSnap.data() as StudioConfig | undefined;
    const serviceSnap = await tx.get(db.collection(COLLECTIONS.services()).doc(b.serviceId));
    const pricing = (serviceSnap.data() as { vehicleCategoryPricing?: never[] } | undefined)?.vehicleCategoryPricing ?? [];
    const breakdown = calculatePrice({
      basePrice: data.basePricePaise,
      vehicleCategory: b.vehicleCategory,
      vehicleCategoryPricing: pricing,
      ...(cfg ? { taxRatePercent: cfg.taxRatePercent, taxDescription: cfg.taxDescription, currency: cfg.currency } : {}),
    });
    const nowIso = new Date().toISOString();
    tx.update(ref, { priceBreakdown: breakdown, totalAmount: breakdown.total, quoteStatus: "quoted", updatedAt: nowIso });
    writeAuditLog(tx, {
      action: "booking.quoted",
      entityType: "Booking",
      entityId: data.bookingId,
      user,
      studioId: b.studioId,
      before: { quoteStatus: b.quoteStatus ?? null, total: b.totalAmount },
      after: { quoteStatus: "quoted", total: breakdown.total },
    });
  });
  return { bookingId: data.bookingId };
});
