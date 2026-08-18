// Studio/admin only. Starts a structured vehicle-condition inspection for a
// job — one per job (id == jobId, same deterministic pattern as Warranty).
// The checklist template is resolved from the job's service category at
// start time and snapshotted onto the inspection; later catalogue changes
// never retroactively alter an in-progress or finalized inspection.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob, Service, Inspection } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { startInspectionSchema } from "../../schemas/inspection.js";
import { buildInspectionChecklist } from "../../lib/inspection-builder.js";

export const startInspection = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);

  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Studio or admin role required.");
  }

  const data = validate(startInspectionSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "inspection.start");

  const db = getFirestore();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
  const job = jobSnap.data() as ServiceJob;

  if (job.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (user.claims.role === "studio" && user.claims.studioId !== job.studioId) {
    throw new HttpsError("permission-denied", "Job belongs to a different studio.");
  }
  if (job.status === "CANCELLED" || job.status === "DELIVERED") {
    throw new HttpsError("failed-precondition", `Cannot start an inspection for a job that is ${job.status}.`);
  }

  const inspectionRef = db.collection(COLLECTIONS.inspections()).doc(job.id);
  const existing = await inspectionRef.get();
  if (existing.exists) {
    throw new HttpsError("already-exists", "An inspection has already been started for this job.");
  }

  const serviceSnap = await db.collection(COLLECTIONS.services()).doc(job.serviceId).get();
  if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
  const service = serviceSnap.data() as Service;

  const now = new Date().toISOString();
  const inspection: Inspection = {
    id: job.id,
    tenantId: job.tenantId,
    studioId: job.studioId,
    jobId: job.id,
    bookingId: job.bookingId,
    customerId: job.customerId,
    vehicleId: job.vehicleId,
    serviceId: job.serviceId,
    serviceName: service.name,
    serviceCategory: service.category,
    status: "in_progress",
    checklist: buildInspectionChecklist(service.category),
    overallNotes: null,
    photos: [],
    startedAt: now,
    startedBy: user.uid,
    finalizedAt: null,
    finalizedBy: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    // create() (not set()) — throws if a concurrent call already created this
    // job's inspection, giving proper race-safety for the one-per-job invariant.
    tx.create(inspectionRef, inspection);
    writeAuditLog(tx, {
      action: "inspection.started",
      entityType: "Inspection",
      entityId: job.id,
      user,
      studioId: job.studioId,
      after: { jobId: job.id, serviceCategory: service.category, itemCount: inspection.checklist.length },
    });
  });

  return { inspection };
});
