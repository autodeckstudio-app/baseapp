import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AttendanceRecord } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getStudioAttendanceSchema } from "../../schemas/attendance.js";
import { utcToLocalDate } from "../../lib/schedule.js";

// Studio attendance board for one day (defaults to today, studio TZ).
// Studio staff can only read their own studio; admins read any studio in
// their tenant.
export const getStudioAttendance = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(getStudioAttendanceSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "attendance.readStudio");

  if (user.claims.role === "studio" && user.claims.studioId !== data.studioId) {
    throw new HttpsError("permission-denied", "Access denied to this studio's attendance.");
  }

  const db = getFirestore();
  const date = data.date ?? utcToLocalDate(new Date(), "Asia/Kolkata");
  const snap = await db
    .collection(COLLECTIONS.attendance())
    .where("tenantId", "==", user.claims.tenantId)
    .where("studioId", "==", data.studioId)
    .where("date", "==", date)
    .get();

  const records = snap.docs.map((doc) => doc.data() as AttendanceRecord);
  records.sort((a, b) => (a.checkInAt ?? "").localeCompare(b.checkInAt ?? ""));
  return { records, date };
});
