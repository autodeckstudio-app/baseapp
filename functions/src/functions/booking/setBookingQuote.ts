import { QUOTE_VALID_MS } from "../../lib/quote-lifecycle.js";
// Admin/studio: set the price on a price-on-request booking. requested -> quoted.
// Recomputes the booking price snapshot from the quoted base price; the service template stays unpriced.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Booking, StudioConfig, ServiceCategory } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { calculatePrice, taxFor } from "../../lib/pricing.js";
import { applyPickupFees } from "../../lib/pickup-fee.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

const schema = z.object({
  bookingId: z.string().min(1),
  basePricePaise: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
}).strict();

export const setBookingQuote = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
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
    if (b.id !== data.bookingId) throw new HttpsError("failed-precondition", "Booking identity needs office review.");
    if (b.priceOnRequest !== true) throw new HttpsError("failed-precondition", "This booking has a fixed price.");
    if (b.quoteStatus === "approved") throw new HttpsError("failed-precondition", "The customer already approved a quote.");
    const cfgSnap = await tx.get(db.collection(COLLECTIONS.studioConfig()).doc(b.studioId));
    const cfg = cfgSnap.data() as StudioConfig | undefined;
    const serviceSnap = await tx.get(db.collection(COLLECTIONS.services()).doc(b.serviceId));
    const svcData = serviceSnap.data() as { vehicleCategoryPricing?: never[]; category?: ServiceCategory } | undefined;
    const pricing = svcData?.vehicleCategoryPricing ?? [];
    if (b.status === "CANCELLED" || b.status === "COMPLETED" || b.status === "EXPIRED") throw new HttpsError("failed-precondition", `Cannot quote a ${b.status.toLowerCase()} booking.`);
    const quoted = calculatePrice({
      basePrice: data.basePricePaise,
      serviceCategory: svcData?.category ?? "other",
      vehicleCategory: b.vehicleCategory,
      vehicleCategoryPricing: pricing,
      ...taxFor(cfg),
      ...(cfg ? { currency: cfg.currency } : {}),
    });
    // The job was created at booking time with a zero price; keep it in step with the quote.
    // Pickup and drop fees already on the booking stay on it: the quote sets the service price only.
    const breakdown = applyPickupFees(quoted, b.priceBreakdown?.pickupFee ?? 0, b.priceBreakdown?.dropFee ?? 0);
    const jobsSnap = await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(2));
    if (jobsSnap.size !== 1) throw new HttpsError("failed-precondition", "The exact linked job needs office review.");
    const linked = jobsSnap.docs[0]!.data();
    if (linked["id"] !== jobsSnap.docs[0]!.id || linked["bookingId"] !== b.id || linked["tenantId"] !== b.tenantId || linked["studioId"] !== b.studioId || linked["customerId"] !== b.customerId || !["PENDING_VEHICLE", "VEHICLE_RECEIVED", "STANDBY"].includes(String(linked["status"])) || linked["offlineSettlement"])
      throw new HttpsError("failed-precondition", "Work started or current job scope needs office review. The quote was not changed.");
    // A payment or invoice fixes the amount. Changing the price under it would leave the books wrong.
    const jobId = jobsSnap.docs[0]?.id;
    if (jobId) {
      const [pay, inv] = await Promise.all([
        tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", jobId).where("status", "in", ["pending", "processing", "completed"]).limit(1)),
        tx.get(db.collection(COLLECTIONS.invoices()).where("jobId", "==", jobId).limit(5)),
      ]);
      if (!pay.empty || inv.docs.some((d) => d.data()["status"] !== "void")) {
        throw new HttpsError("failed-precondition", "A payment or invoice already exists on this booking, so the quote cannot change.");
      }
    }
    const nowIso = new Date().toISOString();
    for (const j of jobsSnap.docs) {
      tx.update(j.ref, { priceBreakdown: breakdown, totalAmount: breakdown.total, updatedAt: nowIso });
    }
    tx.update(ref, { priceBreakdown: breakdown, totalAmount: breakdown.total, quoteStatus: "quoted", quoteExpiresAt: new Date(Date.parse(nowIso) + QUOTE_VALID_MS).toISOString(), consultQuoteApproval:null, updatedAt: nowIso });
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
