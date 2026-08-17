import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getStudioJobsSchema } from "../../schemas/job.js";
import { utcToLocalDate } from "../../lib/schedule.js";

export const getStudioJobs = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(getStudioJobsSchema, request.data);

  const db = getFirestore();

  // Studio users can only query their own studio
  if (user.claims.role === "studio" && user.claims.studioId !== data.studioId) {
    throw new HttpsError("permission-denied", "Access denied to this studio's jobs.");
  }

  // Default to today's date in Asia/Kolkata
  const targetDate = data.date ?? utcToLocalDate(new Date(), "Asia/Kolkata");

  const snap = await db
    .collection(COLLECTIONS.jobs())
    .where("studioId", "==", data.studioId)
    .where("tenantId", "==", user.claims.tenantId)
    .where("scheduledDate", "==", targetDate)
    .orderBy("scheduledAt", "asc")
    .get();

  const jobs = snap.docs.map((doc) => doc.data() as ServiceJob);

  return { jobs, date: targetDate };
});
