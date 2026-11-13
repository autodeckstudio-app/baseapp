import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import {studioClock} from "@autodeck/core";
import type { StudioConfig } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { z } from "zod";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

const schema = z.object({ studioId: z.string().min(1) }).strict();

// Read-only public subset of the studio config for signed-in customers, so the
// Help page and booking copy show the same hours the availability engine uses.
// Never returns bays, tax or anything internal.
export const getStudioInfo = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  const data = validate(schema, request.data);
  await enforceRateLimit(subjectFrom(user), "read.studioInfo");
  const snap = await getFirestore().collection(COLLECTIONS.studioConfig()).doc(data.studioId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Studio not found.");
  const c = snap.data() as StudioConfig;
  if (c.tenantId !== user.claims.tenantId) throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  const local=studioClock(new Date(),c.timezone);
  if(!local)throw new HttpsError("failed-precondition","Studio timezone needs to be confirmed.");
  return {
    name: c.name,
    timezone: c.timezone,
    operatingHours: c.operatingHours,
    holidays: [...new Set(c.holidays)].filter(date=>date>=local.date).sort(),
    slotIntervalMinutes: c.slotIntervalMinutes,
    maxAdvanceBookingDays: c.maxAdvanceBookingDays,
    cancellationWindowHours: c.cancellationWindowHours,
  };
});
