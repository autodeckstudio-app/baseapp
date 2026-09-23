import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Expense } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateExpenseSchema } from "../../schemas/expense.js";
import { assertValidMinorUnits } from "../../lib/pricing.js";

// Admin-only: correct an expense entry. Changing the date re-derives month.
export const updateExpense = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(updateExpenseSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "expense.update");
  if (data.amount !== undefined) assertValidMinorUnits(data.amount, "amount");

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

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of ["amount", "category", "paidVia", "vendor", "notes"] as const) {
      if (data[key] !== undefined) patch[key] = data[key];
    }
    if (data.date !== undefined) {
      patch.date = data.date;
      patch.month = data.date.slice(0, 7);
    }
    tx.update(ref, patch);
    writeAuditLog(tx, {
      action: "expense.updated",
      entityType: "expense",
      entityId: ref.id,
      user,
      studioId: before.studioId,
      before: { amount: before.amount, category: before.category, date: before.date },
      after: patch,
    });
  });

  return { id: data.expenseId };
});
