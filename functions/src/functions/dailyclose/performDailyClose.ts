import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { DailyClose } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { performDailyCloseSchema } from "../../schemas/dailyClose.js";
import { dayAggregates } from "../../lib/dayAggregates.js";

// Admin-only: close the day for one studio. Expected figures are recomputed
// server-side at close time; the admin supplies the counted drawer cash.
// Re-closing a closed date requires reclose: true and is audited separately.
export const performDailyClose = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(performDailyCloseSchema, request.data);
  assertStudio(user, data.studioId, "Daily close");
  await enforceRateLimit(subjectFrom(user), "dailyClose.perform");

  const agg = await dayAggregates(user.claims.tenantId, data.studioId, data.date);

  const db = getFirestore();
  const docId = `${user.claims.tenantId}__${data.studioId}__${data.date}`;
  const ref = db.collection(COLLECTIONS.dailyClosings()).doc(docId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = new Date().toISOString();

    if (snap.exists) {
      const before = snap.data() as DailyClose;
      if (!data.reclose) {
        throw new HttpsError(
          "failed-precondition",
          "This date is already closed. Pass reclose: true to recompute and re-close.",
        );
      }
      tx.update(ref, {
        expectedCashPaise: agg.expectedCashPaise,
        upiPaise: agg.upiPaise,
        cardPaise: agg.razorpayPaise,
        bankTransferPaise: agg.bankTransferPaise,
        totalRevenuePaise: agg.totalRevenuePaise,
        expensesPaise: agg.expensesPaise,
        paymentCount: agg.paymentCount,
        expenseCount: agg.expenseCount,
        countedCashPaise: data.countedCashPaise,
        variancePaise: data.countedCashPaise - agg.expectedCashPaise,
        notes: data.notes ?? before.notes,
        closedBy: user.uid,
        closedAt: now,
        closeCount: before.closeCount + 1,
        updatedAt: now,
      });
      writeAuditLog(tx, {
        action: "dailyClose.reclosed",
        entityType: "dailyClose",
        entityId: docId,
        user,
        studioId: data.studioId,
        before: { countedCashPaise: before.countedCashPaise, variancePaise: before.variancePaise },
        after: { countedCashPaise: data.countedCashPaise, variancePaise: data.countedCashPaise - agg.expectedCashPaise },
      });
    } else {
      const close: DailyClose = {
        id: docId,
        tenantId: user.claims.tenantId,
        studioId: data.studioId,
        date: data.date,
        status: "CLOSED",
        expectedCashPaise: agg.expectedCashPaise,
        upiPaise: agg.upiPaise,
        cardPaise: agg.razorpayPaise,
        bankTransferPaise: agg.bankTransferPaise,
        totalRevenuePaise: agg.totalRevenuePaise,
        expensesPaise: agg.expensesPaise,
        paymentCount: agg.paymentCount,
        expenseCount: agg.expenseCount,
        countedCashPaise: data.countedCashPaise,
        variancePaise: data.countedCashPaise - agg.expectedCashPaise,
        notes: data.notes ?? null,
        closedBy: user.uid,
        closedAt: now,
        closeCount: 1,
        updatedAt: now,
      };
      tx.set(ref, close);
      writeAuditLog(tx, {
        action: "dailyClose.performed",
        entityType: "dailyClose",
        entityId: docId,
        user,
        studioId: data.studioId,
        after: {
          date: data.date,
          totalRevenuePaise: agg.totalRevenuePaise,
          countedCashPaise: data.countedCashPaise,
          variancePaise: close.variancePaise,
        },
      });
    }
  });

  return {
    id: docId,
    expectedCashPaise: agg.expectedCashPaise,
    countedCashPaise: data.countedCashPaise,
    variancePaise: data.countedCashPaise - agg.expectedCashPaise,
  };
});
