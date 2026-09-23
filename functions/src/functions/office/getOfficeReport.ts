import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Expense, Payment, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getOfficeReportSchema } from "../../schemas/office.js";
import { utcToLocalDate } from "../../lib/schedule.js";

// Studio-and-above read: monthly Office report. Revenue by method and by day,
// expenses by category, job throughput — one call per month, computed from
// the same payment/expense sources as Daily Close so numbers always agree.
export const getOfficeReport = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(getOfficeReportSchema, request.data);
  assertStudio(user, data.studioId, "Report");
  await enforceRateLimit(subjectFrom(user), "office.report");

  const db = getFirestore();
  const tenantId = user.claims.tenantId;

  const [paymentsSnap, expensesSnap, jobsSnap] = await Promise.all([
    db.collection(COLLECTIONS.payments())
      .where("tenantId", "==", tenantId)
      .where("studioId", "==", data.studioId)
      .where("status", "==", "completed")
      .orderBy("completedAt", "desc")
      .limit(2000)
      .get(),
    db.collection(COLLECTIONS.expenses())
      .where("tenantId", "==", tenantId)
      .where("studioId", "==", data.studioId)
      .where("month", "==", data.month)
      .limit(1000)
      .get(),
    db.collection(COLLECTIONS.jobs())
      .where("tenantId", "==", tenantId)
      .where("studioId", "==", data.studioId)
      .limit(2000)
      .get(),
  ]);

  let totalRevenuePaise = 0;
  let cashPaise = 0;
  let upiPaise = 0;
  let bankTransferPaise = 0;
  let razorpayPaise = 0;
  let paymentCount = 0;
  const revenueByDay: Record<string, number> = {};

  for (const doc of paymentsSnap.docs) {
    const p = doc.data() as Payment;
    if (!p.completedAt) continue;
    const localDate = utcToLocalDate(new Date(p.completedAt), "Asia/Kolkata");
    if (!localDate.startsWith(data.month)) continue;
    paymentCount += 1;
    totalRevenuePaise += p.amount;
    revenueByDay[localDate] = (revenueByDay[localDate] ?? 0) + p.amount;
    if (p.method === "cash") cashPaise += p.amount;
    else if (p.method === "upi_manual") upiPaise += p.amount;
    else if (p.method === "bank_transfer") bankTransferPaise += p.amount;
    else razorpayPaise += p.amount;
  }

  let expensesPaise = 0;
  const expensesByCategory: Record<string, number> = {};
  for (const doc of expensesSnap.docs) {
    const e = doc.data() as Expense;
    expensesPaise += e.amount;
    expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amount;
  }

  let jobsCompleted = 0;
  let jobsCancelled = 0;
  let jobsCreated = 0;
  for (const doc of jobsSnap.docs) {
    const j = doc.data() as ServiceJob;
    const createdMonth = j.createdAt.slice(0, 7);
    if (createdMonth === data.month) jobsCreated += 1;
    const last = j.statusHistory[j.statusHistory.length - 1];
    if (!last) continue;
    const lastMonth = utcToLocalDate(new Date(last.changedAt), "Asia/Kolkata").slice(0, 7);
    if (lastMonth !== data.month) continue;
    if (j.status === "DELIVERED") jobsCompleted += 1;
    else if (j.status === "CANCELLED") jobsCancelled += 1;
  }

  return {
    month: data.month,
    studioId: data.studioId,
    totalRevenuePaise,
    cashPaise,
    upiPaise,
    bankTransferPaise,
    razorpayPaise,
    paymentCount,
    revenueByDay,
    expensesPaise,
    expensesByCategory,
    netPaise: totalRevenuePaise - expensesPaise,
    jobsCreated,
    jobsCompleted,
    jobsCancelled,
  };
});
