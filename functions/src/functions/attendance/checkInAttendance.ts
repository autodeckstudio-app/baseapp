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

// Studio staff self check-in for the current studio day. One record per
// employee per day: the deterministic document id makes a duplicate check-in
// impossible even under retries or double taps. Studio-scoped staff check in
// to their own studio; tenant admins use markAttendance for other employees.
export const checkInAttendance = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(attendanceCheckSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "attendance.checkIn");

  const roster = await rosterRecordFor(user);
  if (roster.studioId === null) {
    throw new HttpsError(
      "failed-precondition",
      "Tenant admins are not studio-scoped — attendance is recorded per studio.",
    );
  }

  const db = getFirestore();
  const now = new Date().toISOString();
  const date = utcToLocalDate(new Date(), "Asia/Kolkata");
  const docId = `${roster.tenantId}__${roster.id}__${date}`;
  const ref = db.collection(COLLECTIONS.attendance()).doc(docId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      throw new HttpsError("already-exists", "Already checked in for today.");
    }
    const record: AttendanceRecord = {
      id: docId,
      tenantId: roster.tenantId,
      studioId: roster.studioId!,
      employeeId: roster.id,
      employeeAuthUid: roster.authUid,
      date,
      status: "PRESENT",
      checkInAt: now,
      checkOutAt: null,
      breaks: [],
      workedMinutes: 0,
      notes: data.notes ?? null,
      markedBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(ref, record);
    writeAuditLog(tx, {
      action: "attendance.checked_in",
      entityType: "attendance",
      entityId: docId,
      user,
      studioId: roster.studioId,
      after: { date, checkInAt: now },
    });
  });

  return { id: docId, date, checkInAt: now };
});
