import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Expense } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createExpenseSchema } from "../../schemas/expense.js";
import { assertValidMinorUnits } from "../../lib/pricing.js";

// Admin-only: record a studio operating expense. `month` is derived
// server-side from the business date so listExpenses is a single where().
export const createExpense = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(createExpenseSchema, request.data);
  assertStudio(user, data.studioId, "Expense");
  await enforceRateLimit(subjectFrom(user), "expense.create");
  assertValidMinorUnits(data.amount, "amount");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.expenses()).doc();
  const now = new Date().toISOString();

  const expense: Expense = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    studioId: data.studioId,
    amount: data.amount,
    category: data.category,
    paidVia: data.paidVia,
    vendor: data.vendor ?? null,
    date: data.date,
    month: data.date.slice(0, 7),
    notes: data.notes ?? null,
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(ref, expense);
    writeAuditLog(tx, {
      action: "expense.created",
      entityType: "expense",
      entityId: ref.id,
      user,
      studioId: data.studioId,
      after: { amount: expense.amount, category: expense.category, date: expense.date },
    });
  });

  return { id: ref.id };
});
