import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { z } from "zod";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

const schema = z.object({ studioId: z.string().min(1) }).strict();

// Read-only public subset of the studio config for signed-in customers, so the
// Help page and booking copy show the same hours the availability engine uses.
// Never returns bays, tax or anything internal.
export const getStudioInfo = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(schema, request.data);
  await enforceRateLimit(subjectFrom(user), "read.studioInfo");
  const snap = await getFirestore().collection(COLLECTIONS.studioConfig()).doc(data.studioId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Studio not found.");
  const c = snap.data() as StudioConfig;
  if (c.tenantId !== user.claims.tenantId) throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  const today = new Date().toISOString().slice(0, 10);
  return {
    name: c.name,
    timezone: c.timezone,
    operatingHours: c.operatingHours,
    holidays: c.holidays.filter((d) => d >= today).slice(0, 10),
    slotIntervalMinutes: c.slotIntervalMinutes,
    maxAdvanceBookingDays: c.maxAdvanceBookingDays,
    cancellationWindowHours: c.cancellationWindowHours,
  };
});
