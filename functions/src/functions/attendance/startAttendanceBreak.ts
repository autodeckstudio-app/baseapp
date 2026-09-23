import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AttendanceRecord } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { rosterRecordFor } from "../../lib/roster.js";
import { utcToLocalDate } from "../../lib/schedule.js";

// Starts a break on today's self attendance record. Only one open break at a
// time; the open break must be ended before checkout.
export const startAttendanceBreak = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  await enforceRateLimit(subjectFrom(user), "attendance.break");

  const roster = await rosterRecordFor(user);
  const db = getFirestore();
  const now = new Date().toISOString();
  const date = utcToLocalDate(new Date(), "Asia/Kolkata");
  const docId = `${roster.tenantId}__${roster.id}__${date}`;
  const ref = db.collection(COLLECTIONS.attendance()).doc(docId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError("failed-precondition", "No check-in found for today.");
    }
    const record = snap.data() as AttendanceRecord;
    if (record.checkOutAt !== null) {
      throw new HttpsError("failed-precondition", "Already checked out for today.");
    }
    if (record.breaks.some((b) => b.endedAt === null)) {
      throw new HttpsError("already-exists", "A break is already in progress.");
    }
    tx.update(ref, {
      breaks: [...record.breaks, { startedAt: now, endedAt: null }],
      markedBy: user.uid,
      updatedAt: now,
    });
    writeAuditLog(tx, {
      action: "attendance.break_started",
      entityType: "attendance",
      entityId: docId,
      user,
      studioId: record.studioId,
      after: { startedAt: now },
    });
  });

  return { id: docId, date, startedAt: now };
});
