// Customer: approve the studio's quote on their own price-on-request booking. quoted -> approved.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

const schema = z.object({ bookingId: z.string().min(1) }).strict();

export const respondToBookingQuote = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const data = validate(schema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.quoteRespond");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
    const b = snap.data() as Booking;
    assertTenant(user, b.tenantId);
    if (b.customerId !== user.uid) throw new HttpsError("permission-denied", "Not your booking.");
    if (b.quoteStatus !== "quoted") throw new HttpsError("failed-precondition", "There is no quote to approve yet.");
    tx.update(ref, { quoteStatus: "approved", updatedAt: new Date().toISOString() });
    writeAuditLog(tx, { action: "booking.quote_approved", entityType: "Booking", entityId: data.bookingId, user, studioId: b.studioId, before: { quoteStatus: "quoted" }, after: { quoteStatus: "approved", total: b.totalAmount } });
  });
  return { bookingId: data.bookingId };
});
