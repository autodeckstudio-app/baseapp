import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob, Service } from "@autodeck/core";
import { JOB_STATUS_TRANSITIONS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { advanceJobStatusSchema } from "../../schemas/job.js";
import { buildWarranty } from "../../lib/warranty-builder.js";

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

  await db.runTransaction(async (tx) => {
    // All reads before any writes. Warranty issuance is resolved here so the
    // idempotency check (has a Warranty already been written for this job?)
    // sees a fresh, transaction-consistent read — a concurrent/retried call
    // that also reaches DELIVERED will be serialized by Firestore's
    // transaction contention on the job document and, on retry, will see
    // warrantySnap.exists === true and skip re-issuing (same guarantee as
    // bay assignment — doc07 §7.5).
    let warranty: ReturnType<typeof buildWarranty> = null;
    const warrantyRef = db.collection(COLLECTIONS.warranties()).doc(data.jobId);
    if (nextStatus === "DELIVERED") {
      // A job cannot be delivered while additional work is still awaiting
      // the customer's decision — Phase 3 requirement: prevent the studio
      // from treating unauthorized additional work as complete.
      const pendingApprovals = await tx.get(
        db
          .collection(COLLECTIONS.approvals())
          .where("jobId", "==", data.jobId)
          .where("status", "==", "pending")
          .limit(1),
      );
      if (!pendingApprovals.empty) {
        throw new HttpsError(
          "failed-precondition",
          "This job has an approval awaiting the customer's decision. Resolve or cancel it before delivering.",
        );
      }

      const [serviceSnap, warrantySnap] = await Promise.all([
        tx.get(db.collection(COLLECTIONS.services()).doc(job.serviceId)),
        tx.get(warrantyRef),
      ]);
      if (serviceSnap.exists && !warrantySnap.exists) {
        warranty = buildWarranty({ job, service: serviceSnap.data() as Service, sealedAt: now });
      }
    }

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

    if (warranty) {
      tx.set(warrantyRef, warranty);
      writeAuditLog(tx, {
        action: "warranty.issued",
        entityType: "Warranty",
        entityId: warranty.id,
        user,
        studioId: job.studioId,
        after: { jobId: job.id, vehicleId: job.vehicleId, warrantyLabel: warranty.warrantyLabel },
      });
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
