// Phase 5C Batch 1: daily scheduled counterpart to the admin-triggered
// expireStaleApprovals callable. Runs the same sweep logic
// (sweepStaleApprovals) across ALL tenants, with no caller — onSchedule
// triggers have no public invocation endpoint at all (unlike
// onCall/onRequest), so this cannot become publicly callable.
//
// Idempotent: see expiry-sweeps.ts's top-of-file note.
//
// Daily is sufficient here: respondToApproval's lazy check means a
// customer can never act on a stale approval regardless of whether this
// ever runs. This closes the STAFF-FACING staleness gap identified in the
// Phase 5C audit (a studio's approval queue — apps/studio/src/lib/
// approval-service.ts — reads raw pending status with no lazy correction
// of its own) — a bounded, at-most-24h staleness window there is an
// accepted operational tradeoff, not a correctness bug.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { sweepStaleApprovals } from "../../lib/expiry-sweeps.js";
import { retryFailedVehiclePhotoCleanups } from "../../lib/vehicle-delete.js";

export const expireStaleApprovalsScheduled = onSchedule(
  { schedule: "0 2 * * *", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    const db = getFirestore();
    // The two sweeps are independent: a failure in either one must not skip
    // or fail the other, and each failure is logged on its own.
    try {
      await sweepStaleApprovals(db);
    } catch (err) {
      logger.error("Stale approval sweep failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    // Vehicle photo cleanup retry rides this EXISTING daily job so the
    // owner-authorized deletion policy (28 Oct 2026) gains an automatic
    // retry without a new Cloud Scheduler job (a new recurring billed
    // resource). Only tombstones the deletion flow itself marked
    // photoCleanup.status == "failed" are retried - never historical records.
    // Independent of the approvals sweep above: either may fail alone.
    try {
      const outcome = await retryFailedVehiclePhotoCleanups(db, getStorage().bucket());
      if (outcome.attempted > 0) logger.info("Vehicle photo cleanup retry pass", outcome);
    } catch (err) {
      logger.error("Vehicle photo cleanup retry pass failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
);
