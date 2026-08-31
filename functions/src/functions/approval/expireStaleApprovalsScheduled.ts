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
import { getFirestore } from "firebase-admin/firestore";
import { sweepStaleApprovals } from "../../lib/expiry-sweeps.js";

export const expireStaleApprovalsScheduled = onSchedule(
  { schedule: "0 2 * * *", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    const db = getFirestore();
    await sweepStaleApprovals(db);
  },
);
