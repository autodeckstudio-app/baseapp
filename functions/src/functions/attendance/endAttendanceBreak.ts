import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AttendanceRecord } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { rosterRecordFor } from "../../lib/roster.js";
import { utcToLocalDate } from "../../lib/schedule.js";

// Ends the open break on today's self attendance record.
export const endAttendanceBreak = onCall({ region: "asia-south1" }, async (request) => {
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
    const openIndex = record.breaks.findIndex((b) => b.endedAt === null);
    if (openIndex === -1) {
      throw new HttpsError("failed-precondition", "No break is in progress.");
    }
    const breaks = record.breaks.map((b, i) => (i === openIndex ? { ...b, endedAt: now } : b));
    tx.update(ref, { breaks, markedBy: user.uid, updatedAt: now });
    writeAuditLog(tx, {
      action: "attendance.break_ended",
      entityType: "attendance",
      entityId: docId,
      user,
      studioId: record.studioId,
      after: { endedAt: now },
    });
  });

  return { id: docId, date, endedAt: now };
});
