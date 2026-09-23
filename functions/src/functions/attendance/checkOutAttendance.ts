import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AttendanceRecord } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { attendanceCheckSchema } from "../../schemas/attendance.js";
import { rosterRecordFor } from "../../lib/roster.js";
import { utcToLocalDate } from "../../lib/schedule.js";

// Self check-out for the current studio day. Computes workedMinutes
// server-side from check-in minus completed break time. Requires any open
// break to be ended first so the worked total is never understated silently.
export const checkOutAttendance = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(attendanceCheckSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "attendance.checkOut");

  const roster = await rosterRecordFor(user);
  const db = getFirestore();
  const now = new Date().toISOString();
  const date = utcToLocalDate(new Date(), "Asia/Kolkata");
  const docId = `${roster.tenantId}__${roster.id}__${date}`;
  const ref = db.collection(COLLECTIONS.attendance()).doc(docId);

  let workedMinutes = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError("failed-precondition", "No check-in found for today.");
    }
    const record = snap.data() as AttendanceRecord;
    if (record.checkOutAt !== null) {
      throw new HttpsError("already-exists", "Already checked out for today.");
    }
    if (record.breaks.some((b) => b.endedAt === null)) {
      throw new HttpsError("failed-precondition", "End the current break before checking out.");
    }
    const checkInMs = Date.parse(record.checkInAt!);
    const breakMs = record.breaks.reduce(
      (sum, b) => sum + (Date.parse(b.endedAt!) - Date.parse(b.startedAt)),
      0,
    );
    workedMinutes = Math.max(0, Math.round((Date.parse(now) - checkInMs - breakMs) / 60000));
    tx.update(ref, {
      checkOutAt: now,
      workedMinutes,
      notes: data.notes ?? record.notes,
      markedBy: user.uid,
      updatedAt: now,
    });
    writeAuditLog(tx, {
      action: "attendance.checked_out",
      entityType: "attendance",
      entityId: docId,
      user,
      studioId: record.studioId,
      before: { checkOutAt: record.checkOutAt },
      after: { checkOutAt: now, workedMinutes },
    });
  });

  return { id: docId, date, checkOutAt: now, workedMinutes };
});
