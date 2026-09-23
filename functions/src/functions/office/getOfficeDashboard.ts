import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AttendanceRecord, InventoryItem, PaperVerification, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getOfficeDashboardSchema } from "../../schemas/office.js";
import { dayAggregates } from "../../lib/dayAggregates.js";
import { utcToLocalDate } from "../../lib/schedule.js";

// Studio-and-above read: one-call Office dashboard for today (Asia/Kolkata).
// Aggregates jobs, revenue, attendance, approvals, low stock and pending
// papers into a single response so the dashboard is not six client queries.
export const getOfficeDashboard = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(getOfficeDashboardSchema, request.data);
  assertStudio(user, data.studioId, "Dashboard");
  await enforceRateLimit(subjectFrom(user), "office.dashboard");

  const db = getFirestore();
  const today = utcToLocalDate(new Date(), "Asia/Kolkata");
  const tenantId = user.claims.tenantId;

  const [money, jobsSnap, attendanceSnap, approvalsSnap, itemsSnap, papersSnap] = await Promise.all([
    dayAggregates(tenantId, data.studioId, today),
    db.collection(COLLECTIONS.jobs())
      .where("tenantId", "==", tenantId)
      .where("studioId", "==", data.studioId)
      .where("scheduledDate", "==", today)
      .limit(500)
      .get(),
    db.collection(COLLECTIONS.attendance())
      .where("tenantId", "==", tenantId)
      .where("studioId", "==", data.studioId)
      .where("date", "==", today)
      .limit(500)
      .get(),
    db.collection(COLLECTIONS.approvals())
      .where("tenantId", "==", tenantId)
      .where("status", "==", "pending")
      .limit(500)
      .get(),
    db.collection(COLLECTIONS.inventoryItems())
      .where("tenantId", "==", tenantId)
      .where("studioId", "==", data.studioId)
      .where("active", "==", true)
      .limit(500)
      .get(),
    db.collection(COLLECTIONS.papers())
      .where("tenantId", "==", tenantId)
      .where("studioId", "==", data.studioId)
      .where("status", "==", "PENDING")
      .limit(500)
      .get(),
  ]);

  const soonDate = new Date(`${today}T00:00:00Z`);
  soonDate.setUTCDate(soonDate.getUTCDate() + 30);
  const soon = soonDate.toISOString().slice(0, 10);

  const jobs = jobsSnap.docs.map((d) => d.data() as ServiceJob);
  const attendance = attendanceSnap.docs.map((d) => d.data() as AttendanceRecord);
  const items = itemsSnap.docs.map((d) => d.data() as InventoryItem);
  const papers = papersSnap.docs.map((d) => d.data() as PaperVerification);

  return {
    date: today,
    studioId: data.studioId,
    jobsToday: jobs.length,
    jobsInProgress: jobs.filter((j) => j.status === "IN_PROGRESS" || j.status === "QUALITY_CHECK").length,
    jobsDelivered: jobs.filter((j) => j.status === "DELIVERED").length,
    revenue: money,
    staffPresent: attendance.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length,
    staffMarked: attendance.length,
    pendingApprovals: approvalsSnap.size,
    lowStockItems: items
      .filter((i) => i.stockQty <= i.lowStockThreshold)
      .map((i) => ({ id: i.id, name: i.name, stockQty: i.stockQty, unit: i.unit })),
    pendingPapers: papers.length,
    papersExpiringSoon: papers.filter(
      (p) => p.expiresOn !== null && p.expiresOn >= today && p.expiresOn <= soon,
    ).length,
  };
});
