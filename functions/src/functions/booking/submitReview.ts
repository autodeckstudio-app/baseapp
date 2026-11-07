// A customer rates a completed booking: 1-5 stars and an optional note.
// One review per booking (doc id = bookingId); a second call updates it.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { resolveCustomerDocId } from "../../lib/customer-identity.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

const submitReviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export const submitReview = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const data = validate(submitReviewSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.review");

  const db = getFirestore();
  // Declared boundary and base capability unchanged (see getPickupQuote): resolve to the
  // canonical customer doc id when one exists, otherwise keep the exact base uid keying.
  const customerDocId = (await resolveCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid)) ?? user.uid;
  const snap = await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = snap.data() as Booking;
  assertTenant(user, booking.tenantId);
  if (booking.customerId !== customerDocId && booking.customerId !== user.uid) throw new HttpsError("permission-denied", "This is not your booking.");
  if (booking.status !== "COMPLETED") throw new HttpsError("failed-precondition", "You can rate a visit once it is completed.");

  const now = new Date().toISOString();
  const ref = db.collection(COLLECTIONS.reviews()).doc(data.bookingId);
  const prev = await ref.get();
  await ref.set({
    id: data.bookingId,
    bookingId: data.bookingId,
    tenantId: booking.tenantId,
    customerId: customerDocId,
    serviceId: booking.serviceId,
    rating: data.rating,
    comment: data.comment ?? "",
    createdAt: prev.exists ? (prev.data() as { createdAt: string }).createdAt : now,
    updatedAt: now,
  });
  return { ok: true };
});
