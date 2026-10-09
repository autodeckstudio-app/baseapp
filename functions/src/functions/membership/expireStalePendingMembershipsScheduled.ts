// Hourly scheduled sweep for pending (never-paid) membership purchases.
// Cancels requests older than the tenant's configured window (default
// MEMBERSHIP_PENDING_EXPIRY_HOURS = 48h) so unconfirmed purchases cannot sit
// pending forever. Idempotent by construction: cancelled docs no longer match
// the status='pending' query, and paid/active records are never touched.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { sweepStalePendingMemberships } from "../../lib/expiry-sweeps.js";

export const expireStalePendingMembershipsScheduled = onSchedule(
  { schedule: "15 * * * *", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    const db = getFirestore();
    await sweepStalePendingMemberships(db);
  },
);
