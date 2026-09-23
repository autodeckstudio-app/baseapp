import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AttendanceRecord } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getEmployeeAttendanceSchema } from "../../schemas/attendance.js";
import { rosterRecordFor, rosterRecordById } from "../../lib/roster.js";

// One employee's attendance for a calendar month ("YYYY-MM"). Staff may read
// their own history; reading anyone else's requires admin (or superadmin).
export const getEmployeeAttendance = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(getEmployeeAttendanceSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "attendance.readEmployee");

  const isAdmin = user.claims.role === "admin" || user.claims.role === "superadmin";
  if (!isAdmin) {
    const roster = await rosterRecordFor(user);
    if (roster.id !== data.employeeId) {
      throw new HttpsError("permission-denied", "Staff can only read their own attendance.");
    }
  } else {
    await rosterRecordById(user, data.employeeId);
  }

  const db = getFirestore();
  const snap = await db
    .collection(COLLECTIONS.attendance())
    .where("tenantId", "==", user.claims.tenantId)
    .where("employeeId", "==", data.employeeId)
    .where("date", ">=", `${data.month}-01`)
    .where("date", "<=", `${data.month}-31`)
    .orderBy("date", "asc")
    .get();

  const records = snap.docs.map((doc) => doc.data() as AttendanceRecord);
  return { records, month: data.month };
});
