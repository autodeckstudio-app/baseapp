import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob } from "@autodeck/core";
import { JOB_STATUS_TRANSITIONS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { advanceJobStatusSchema } from "../../schemas/job.js";

export const advanceJobStatus = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(advanceJobStatusSchema, request.data);

  const db = getFirestore();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
  const job = jobSnap.data() as ServiceJob;

  assertTenant(user, job.tenantId);

  // Studio users are scoped to their own studio
  if (user.claims.role === "studio" && user.claims.studioId !== job.studioId) {
    throw new HttpsError("permission-denied", "Job belongs to a different studio.");
  }

  const validTransitions = JOB_STATUS_TRANSITIONS[job.status] ?? [];
  if (validTransitions.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      `Job is in terminal status '${job.status}' and cannot be advanced.`,
    );
  }

  // For forward advancement, pick the first valid non-CANCELLED transition.
  // For CANCELLED specifically, it must be explicitly requested (handled by cancelBooking).
  const nextStatus = validTransitions.find((s) => s !== "CANCELLED");
  if (!nextStatus) {
    throw new HttpsError(
      "failed-precondition",
      `No forward transition available from status '${job.status}'.`,
    );
  }

  const now = new Date().toISOString();
  const newHistoryEntry = {
    status: nextStatus,
    changedAt: now,
    changedBy: user.uid,
    notes: data.notes ?? null,
  };

  const updates: Record<string, unknown> = {
    status: nextStatus,
    statusHistory: [...job.statusHistory, newHistoryEntry],
    updatedAt: now,
  };

  // Seal the job when delivered
  if (nextStatus === "DELIVERED") {
    updates["sealedAt"] = now;
    // Update the linked booking to COMPLETED
    if (job.bookingId) {
      updates["_linkedBookingId"] = job.bookingId;
    }
  }

  // When vehicle is received (check-in), transition booking to ACTIVE
  if (nextStatus === "VEHICLE_RECEIVED" && job.bookingId) {
    updates["_linkedBookingId"] = job.bookingId;
    updates["_bookingStatus"] = "ACTIVE";
  }

  await db.runTransaction(async (tx) => {
    tx.update(db.collection(COLLECTIONS.jobs()).doc(data.jobId), {
      status: nextStatus,
      statusHistory: [...job.statusHistory, newHistoryEntry],
      updatedAt: now,
      ...(nextStatus === "DELIVERED" ? { sealedAt: now } : {}),
    });

    // Sync booking status
    if (job.bookingId) {
      const bookingUpdate: Record<string, unknown> = { updatedAt: now };
      if (nextStatus === "VEHICLE_RECEIVED") {
        bookingUpdate["status"] = "ACTIVE";
      } else if (nextStatus === "DELIVERED") {
        bookingUpdate["status"] = "COMPLETED";
      }
      if (Object.keys(bookingUpdate).length > 1) {
        tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), bookingUpdate);
      }
    }

    writeAuditLog(tx, {
      action: "job.status_advanced",
      entityType: "ServiceJob",
      entityId: data.jobId,
      user,
      studioId: job.studioId,
      before: { status: job.status },
      after: { status: nextStatus },
    });
  });

  return { jobId: data.jobId, previousStatus: job.status, newStatus: nextStatus };
});
