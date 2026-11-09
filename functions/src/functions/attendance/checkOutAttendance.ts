import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AttendanceRecord } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { z } from "zod";
import { attendanceCheckSchema } from "../../schemas/attendance.js";
import { rosterRecordFor } from "../../lib/roster.js";
import { utcToLocalDate } from "../../lib/schedule.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

// Self check-out for the current studio day. Computes workedMinutes
// server-side from check-in minus break time. An open break can end only when
// the caller explicitly selects the atomic end-break-and-checkout action.
export const checkOutAttendance = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    assertRole(user, "studio", "admin", "superadmin");
    const data = validate(
      attendanceCheckSchema
        .extend({ endOpenBreak: z.boolean().optional() })
        .strict(),
      request.data,
    );
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
        throw new HttpsError(
          "failed-precondition",
          "No check-in found for today.",
        );
      }
      const record = snap.data() as AttendanceRecord;
      if (!record.checkInAt) {
        throw new HttpsError(
          "failed-precondition",
          "Check in before starting a break or checking out.",
        );
      }
      if (record.checkOutAt !== null) {
        throw new HttpsError(
          "already-exists",
          "Already checked out for today.",
        );
      }
      const open = record.breaks.filter((b) => b.endedAt === null);
      if (open.length > 1)
        throw new HttpsError(
          "failed-precondition",
          "Attendance needs Admin review.",
        );
      if (open.length && !data.endOpenBreak) {
        throw new HttpsError(
          "failed-precondition",
          "End the current break before checking out.",
        );
      }
      const checkInMs = Date.parse(record.checkInAt!);
      const breaks = record.breaks.map((b) =>
        b.endedAt === null ? { ...b, endedAt: now } : b,
      );
      if (
        breaks.some(
          (b) =>
            !Number.isFinite(Date.parse(b.startedAt)) ||
            !Number.isFinite(Date.parse(b.endedAt!)) ||
            Date.parse(b.startedAt) < checkInMs ||
            Date.parse(b.endedAt!) < Date.parse(b.startedAt) ||
            Date.parse(b.endedAt!) > Date.parse(now),
        )
      )
        throw new HttpsError(
          "failed-precondition",
          "Attendance times need Admin review.",
        );
      const breakMs = breaks.reduce(
        (sum, b) => sum + (Date.parse(b.endedAt!) - Date.parse(b.startedAt)),
        0,
      );
      workedMinutes = Math.max(
        0,
        Math.round((Date.parse(now) - checkInMs - breakMs) / 60000),
      );
      tx.update(ref, {
        checkOutAt: now,
        breaks,
        workedMinutes,
        notes: data.notes ?? record.notes,
        markedBy: user.uid,
        updatedAt: now,
      });
      if (open.length)
        writeAuditLog(tx, {
          action: "attendance.break_ended",
          entityType: "attendance",
          entityId: docId,
          user,
          studioId: record.studioId,
          before: { breaks: record.breaks },
          after: { breaks, via: "explicit_end_break_and_checkout" },
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
  },
);
