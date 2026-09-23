import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { DailyClose } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getDailyCloseSchema } from "../../schemas/dailyClose.js";
import { dayAggregates } from "../../lib/dayAggregates.js";

// Studio-and-above read: the close record for a date if it exists, plus the
// live aggregates for that date so the screen can preview before closing.
export const getDailyClose = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(getDailyCloseSchema, request.data);
  assertStudio(user, data.studioId, "Daily close");
  await enforceRateLimit(subjectFrom(user), "dailyClose.read");

  const db = getFirestore();
  const docId = `${user.claims.tenantId}__${data.studioId}__${data.date}`;
  const snap = await db.collection(COLLECTIONS.dailyClosings()).doc(docId).get();
  const close = snap.exists ? (snap.data() as DailyClose) : null;
  const live = await dayAggregates(user.claims.tenantId, data.studioId, data.date);

  return { close, live };
});
