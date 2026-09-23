import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Expense } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { deleteExpenseSchema } from "../../schemas/expense.js";

// Admin-only: remove a wrongly-recorded expense. Audited with full before-state.
export const deleteExpense = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(deleteExpenseSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "expense.delete");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.expenses()).doc(data.expenseId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Expense not found.");
    const before = snap.data() as Expense;
    if (user.claims.role !== "superadmin" && before.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Expense belongs to a different tenant.");
    }
    assertStudio(user, before.studioId, "Expense");

    tx.delete(ref);
    writeAuditLog(tx, {
      action: "expense.deleted",
      entityType: "expense",
      entityId: ref.id,
      user,
      studioId: before.studioId,
      before: {
        amount: before.amount,
        category: before.category,
        paidVia: before.paidVia,
        vendor: before.vendor,
        date: before.date,
      },
    });
  });

  return { id: data.expenseId, deleted: true };
});
