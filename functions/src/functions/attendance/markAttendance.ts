import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AttendanceRecord } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { markAttendanceSchema } from "../../schemas/attendance.js";
import { rosterRecordById } from "../../lib/roster.js";

// Admin-only: record or correct an employee's status for a date (ABSENT /
// ON_LEAVE / HALF_DAY / PRESENT). Never alters recorded check-in/out times —
// a PRESENT mark on a day with no times simply records the status, which the
// office sees as an unverified presence needing the employee's own check-in.
export const markAttendance = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(markAttendanceSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "attendance.mark");

  const employee = await rosterRecordById(user, data.employeeId);
  if (employee.studioId === null) {
    throw new HttpsError(
      "failed-precondition",
      "Tenant admins are not studio-scoped — attendance is recorded per studio.",
    );
  }

  const db = getFirestore();
  const now = new Date().toISOString();
  const docId = `${employee.tenantId}__${employee.id}__${data.date}`;
  const ref = db.collection(COLLECTIONS.attendance()).doc(docId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const before = snap.data() as AttendanceRecord;
      tx.update(ref, {
        status: data.status,
        notes: data.notes ?? before.notes,
        markedBy: user.uid,
        updatedAt: now,
      });
      writeAuditLog(tx, {
        action: "attendance.marked",
        entityType: "attendance",
        entityId: docId,
        user,
        studioId: before.studioId,
        before: { status: before.status },
        after: { status: data.status },
      });
    } else {
      const record: AttendanceRecord = {
        id: docId,
        tenantId: employee.tenantId,
        studioId: employee.studioId!,
        employeeId: employee.id,
        employeeAuthUid: employee.authUid,
        date: data.date,
        status: data.status,
        checkInAt: null,
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
        action: "attendance.marked",
        entityType: "attendance",
        entityId: docId,
        user,
        studioId: employee.studioId,
        after: { status: data.status, date: data.date },
      });
    }
  });

  return { id: docId, date: data.date, status: data.status };
});
