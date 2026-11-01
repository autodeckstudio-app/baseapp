import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob, StudioConfig, Service } from "@autodeck/core";
import { jobHoldsBay } from "@autodeck/core";
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
import { computeScheduleEnd } from "../../lib/schedule.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const assignBay = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
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

  if (job.status === "STANDBY") throw new HttpsError("failed-precondition", "Admit standby through the waiting queue, not bay reassignment.");

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
    const freshSnap = await tx.get(db.collection(COLLECTIONS.jobs()).doc(data.jobId));
    const fresh = freshSnap.data() as ServiceJob | undefined;
    if (!fresh || fresh.status === "STANDBY" || fresh.status === "DELIVERED" || fresh.status === "CANCELLED" || fresh.status !== job.status || fresh.bayId !== job.bayId || fresh.scheduledAt !== job.scheduledAt) {
      throw new HttpsError("failed-precondition", "Job changed. Reload it before assigning a bay.");
    }

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
    //
    // Two honest layers on ONE status-based query (no scheduledDate window —
    // a job that started weeks ago and was never closed still physically
    // holds its bay, and a date range around the target's schedule would
    // miss it; this function is also the last guard when moving a physically
    // present car, since the check-in guard only fires on the
    // PENDING_VEHICLE -> VEHICLE_RECEIVED transition):
    //  1. Physical presence: if the job being assigned is present now (its
    //     window covers now or it is already active), any ACTIVE-status job
    //     on the target bay blocks the move, regardless of its schedule.
    //  2. Reservations: every other live job keeps its scheduled-interval
    //     conflict check against the job's own window, so future
    //     reservations are still honoured.
    const activeJobsSnap = await tx.get(
      db
        .collection(COLLECTIONS.jobs())
        .where("studioId", "==", job.studioId)
        .where("bayId", "==", data.bayId)
        .where("status", "in", ["PENDING_VEHICLE", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"]),
    );

    const others = activeJobsSnap.docs
      .map((d) => ({ ...(d.data() as ServiceJob), id: d.id }))
      .filter((j) => j.id !== data.jobId); // the job being reassigned never conflicts with itself
    const nowMs = Date.parse(now);
    const targetPresent =
      job.status !== "PENDING_VEHICLE" ||
      (nowMs >= Date.parse(job.scheduledAt) && nowMs <= Date.parse(job.estimatedEndAt));
    if (targetPresent) {
      const holder = others.find((j) => ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"].includes(j.status));
      if (holder) {
        throw new HttpsError(
          "resource-exhausted",
          `Target bay is still occupied by job ${holder.id} (${holder.status}). Close that job or select a different bay.`,
        );
      }
    }

    const occupied: OccupiedInterval[] = [];
    for (const otherJob of others) {
      // No-show expiry: an overdue PENDING_VEHICLE reservation whose window
      // has passed holds nothing and must not block scheduling.
      if (otherJob.status === "PENDING_VEHICLE" && !jobHoldsBay(otherJob, nowMs)) continue;
      occupied.push(buildOccupiedInterval(otherJob.scheduledAt, otherJob.estimatedEndAt));
    }

    // A job that is physically present (active, or its window covers now)
    // occupies the target bay from NOW for the service's full duration -
    // same computeScheduleEnd pattern as standby admission. Its stored
    // window may be stale (late check-in, overrun), and using it here would
    // understate occupancy and slip a future reservation conflict. For an
    // already-active job the full duration is a deliberate fail-safe
    // overestimate of the remaining work. Future (not-present) targets keep
    // pure scheduled-window semantics.
    const conflictStart = targetPresent ? new Date(now) : new Date(job.scheduledAt);
    const conflictEnd = targetPresent
      ? computeScheduleEnd(new Date(now), job.estimatedDurationMinutes, config.operatingHours, config.holidays, config.timezone)
      : new Date(job.estimatedEndAt);
    if (hasConflict(conflictStart, conflictEnd, occupied)) {
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
