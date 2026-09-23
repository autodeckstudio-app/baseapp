import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Expense } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { listExpensesSchema } from "../../schemas/expense.js";

// Studio-and-above read: expenses for one studio, optionally one month and/or
// one category. Ordered by date desc; capped at 200 rows per call.
export const listExpenses = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(listExpensesSchema, request.data);
  assertStudio(user, data.studioId, "Expense");
  await enforceRateLimit(subjectFrom(user), "expense.read");

  const db = getFirestore();
  let query: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.expenses())
    .where("tenantId", "==", user.claims.tenantId)
    .where("studioId", "==", data.studioId);
  if (data.month) query = query.where("month", "==", data.month);
  if (data.category) query = query.where("category", "==", data.category);
  query = query.orderBy("date", "desc").limit(200);

  const snap = await query.get();
  const expenses = snap.docs.map((d) => d.data() as Expense);
  const totalPaise = expenses.reduce((sum, e) => sum + e.amount, 0);
  return { expenses, totalPaise };
});
