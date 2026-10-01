// Aggregated customer reviews for one service: average, count and a few
// recent comments. No customer identity is returned. Read-only.
import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

const schema = z.object({ serviceId: z.string().min(1) }).strict();

export const getServiceReviews = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(schema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.review");

  const snap = await getFirestore()
    .collection(COLLECTIONS.reviews())
    .where("tenantId", "==", user.claims.tenantId)
    .where("serviceId", "==", data.serviceId)
    .limit(300)
    .get();
  const rows = snap.docs.map((d) => d.data() as { rating: number; comment: string; updatedAt: string });
  const count = rows.length;
  const average = count === 0 ? null : Math.round((rows.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10;
  const recent = rows
    .filter((r) => r.comment.trim().length > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
    .map((r) => ({ rating: r.rating, comment: r.comment.trim(), date: r.updatedAt.slice(0, 10) }));
  return { average, count, recent };
});
