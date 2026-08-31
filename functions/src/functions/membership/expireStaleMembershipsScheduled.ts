// Phase 5C Batch 1: daily scheduled counterpart to the admin-triggered
// expireStaleMemberships callable. Runs the same sweep logic
// (sweepStaleMemberships) across ALL tenants, with no caller — nothing
// customer- or studio-facing ever triggers this, and onSchedule triggers
// have no public invocation endpoint at all (unlike onCall/onRequest),
// so this cannot become publicly callable.
//
// Idempotent: see expiry-sweeps.ts's top-of-file note — a doc that's
// already been flipped no longer matches the sweep's query, so an
// overlapping or retried execution is a safe no-op, not a double-write.
//
// Daily is sufficient here: money/workflow-correctness never depends on
// this running (createBooking's lazy check and getMyMemberships' read-time
// getEffectiveMembershipStatus both stay correct with zero sweep runs).
// This closes the STAFF-FACING staleness gap identified in the Phase 5C
// audit (admin dashboard active-membership counts reading raw, uncorrected
// status) — a bounded, at-most-24h staleness window there is an accepted
// operational tradeoff, not a correctness bug.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { sweepStaleMemberships } from "../../lib/expiry-sweeps.js";

export const expireStaleMembershipsScheduled = onSchedule(
  { schedule: "0 2 * * *", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    const db = getFirestore();
    await sweepStaleMemberships(db);
  },
);
