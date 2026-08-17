import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getMyBookingsSchema } from "../../schemas/booking.js";

export const getMyBookings = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(getMyBookingsSchema, request.data);

  const db = getFirestore();

  let q = db
    .collection(COLLECTIONS.bookings())
    .where("customerId", "==", user.uid)
    .where("tenantId", "==", user.claims.tenantId)
    .orderBy("scheduledAt", "desc");

  if (data.status) {
    q = db
      .collection(COLLECTIONS.bookings())
      .where("customerId", "==", user.uid)
      .where("tenantId", "==", user.claims.tenantId)
      .where("status", "==", data.status)
      .orderBy("scheduledAt", "desc");
  }

  const snap = await q.limit(50).get();
  const bookings = snap.docs.map((doc) => doc.data() as Booking);

  return { bookings };
});
