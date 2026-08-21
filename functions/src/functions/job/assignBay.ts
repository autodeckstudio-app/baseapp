import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob, StudioConfig, Service } from "@autodeck/core";
import { MAX_SERVICE_SPAN_DAYS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { assignBaySchema } from "../../schemas/job.js";
import {
  buildOccupiedInterval,
  hasConflict,
  type OccupiedInterval,
} from "../../lib/availability.js";
import { addDays } from "../../lib/schedule.js";

export const assignBay = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(assignBaySchema, request.data);
  await enforceRateLimit(subjectFrom(user), "job.assignBay");

  const db = getFirestore();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
  const job = jobSnap.data() as ServiceJob;

  assertTenant(user, job.tenantId);

  if (user.claims.role === "studio" && user.claims.studioId !== job.studioId) {
    throw new HttpsError("permission-denied", "Job belongs to a different studio.");
  }

  if (job.status === "DELIVERED" || job.status === "CANCELLED") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot reassign bay for a job with status '${job.status}'.`,
    );
  }

  // Verify the new bay exists, is active, and is compatible with the job's
  // service (Phase 5B P1-2 fix — this check was previously entirely absent,
  // unlike createWalkinJob/createBooking, letting a bay be assigned to a job
  // whose service it can't actually serve).
  const [configSnap, serviceSnap] = await Promise.all([
    db.collection(COLLECTIONS.studioConfig()).doc(job.studioId).get(),
    db.collection(COLLECTIONS.services()).doc(job.serviceId).get(),
  ]);
  if (!configSnap.exists) throw new HttpsError("not-found", "Studio config not found.");
  if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
  const config = configSnap.data() as StudioConfig;
  const service = serviceSnap.data() as Service;

  const bay = config.bays.find((b) => b.id === data.bayId);
  if (!bay) throw new HttpsError("not-found", "Bay not found in studio configuration.");
  if (!bay.active) throw new HttpsError("failed-precondition", "Target bay is not active.");
  if (bay.bayType !== service.requiredBayType) {
    throw new HttpsError(
      "failed-precondition",
      `Bay type '${bay.bayType}' is not compatible with service requiring '${service.requiredBayType}'.`,
    );
  }

  const previousBayId = job.bayId;
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    // Deterministic-document touch for the target bay — same bayLocks
    // pattern as createBooking.ts/createWalkinJob.ts (Phase 5B fix).
    const bayLockRef = db
      .collection(COLLECTIONS.bayLocks())
      .doc(`${job.tenantId}__${job.studioId}__${data.bayId}`);
    await tx.get(bayLockRef);

    // Occupancy/conflict check against the job's own scheduled window
    // (Phase 5B P1-2 fix — this function previously performed NO conflict
    // check at all, unlike createWalkinJob/createBooking, letting the same
    // bay be assigned to two overlapping jobs and silently corrupting the
    // one-job-per-bay invariant the availability engine depends on).
    const rangeStartDate = addDays(job.scheduledDate, -MAX_SERVICE_SPAN_DAYS);
    const rangeEndDate = addDays(job.scheduledDate, MAX_SERVICE_SPAN_DAYS);
    const activeJobsSnap = await tx.get(
      db
        .collection(COLLECTIONS.jobs())
        .where("studioId", "==", job.studioId)
        .where("bayId", "==", data.bayId)
        .where("scheduledDate", ">=", rangeStartDate)
        .where("scheduledDate", "<=", rangeEndDate),
    );

    const occupied: OccupiedInterval[] = [];
    for (const doc of activeJobsSnap.docs) {
      if (doc.id === data.jobId) continue; // the job being reassigned never conflicts with itself
      const otherJob = doc.data() as ServiceJob;
      if (otherJob.status === "CANCELLED" || otherJob.status === "DELIVERED") continue;
      occupied.push(buildOccupiedInterval(otherJob.scheduledAt, otherJob.estimatedEndAt));
    }

    if (hasConflict(new Date(job.scheduledAt), new Date(job.estimatedEndAt), occupied)) {
      throw new HttpsError(
        "resource-exhausted",
        "Target bay is occupied for this job's scheduled window. Please select a different bay.",
      );
    }

    tx.update(db.collection(COLLECTIONS.jobs()).doc(data.jobId), {
      bayId: data.bayId,
      updatedAt: now,
    });

    // Also update the linked booking's bayId
    if (job.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), {
        bayId: data.bayId,
        updatedAt: now,
      });
    }

    // Write the bay lock read above — forces Firestore to detect a conflict
    // and retry a genuinely concurrent second caller racing for this bay.
    tx.set(bayLockRef, { lastAssignedAt: now });

    writeAuditLog(tx, {
      action: "job.bay_reassigned",
      entityType: "ServiceJob",
      entityId: data.jobId,
      user,
      studioId: job.studioId,
      before: { bayId: previousBayId },
      after: { bayId: data.bayId, reason: data.reason ?? null },
    });
  }, { maxAttempts: 10 });

  return { jobId: data.jobId, previousBayId, newBayId: data.bayId };
});
