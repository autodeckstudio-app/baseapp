// Studio/admin records one interior refresh consumed against a visit job.
// The Platinum interior refresh (vacuuming, dashboard/door-panel wipe and
// interior glass; never shampoo or deep cleaning - owner-approved definition
// 18 Nov 2026) is a plan benefit, not a catalogue service: no price is
// computed and no payment is touched. Counters live on the Membership
// snapshot (refreshesTotal/refreshesUsed); each consumption is one row in
// the membership's refreshUsage subcollection, deliberately separate from
// the wash/discount `usage` subcollection whose money paths assert exactly
// one row per job. One refresh per visit job: (membershipId, jobId) is the
// idempotency key, and a replay returns the existing row without moving the
// counter.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type {
  Membership,
  MembershipRefreshUsage,
  ServiceJob,
} from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import {
  extractUser,
  assertRole,
  assertTenant,
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { recordMembershipRefreshSchema } from "../../schemas/membership.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const recordMembershipRefresh = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    assertRole(user, "studio", "admin", "superadmin");

    const data = validate(recordMembershipRefreshSchema, request.data);
    await enforceRateLimit(subjectFrom(user), "membership.refreshRecord");

    const db = getFirestore();
    const membershipRef = db
      .collection(COLLECTIONS.memberships())
      .doc(data.membershipId);
    const jobRef = db.collection(COLLECTIONS.jobs()).doc(data.jobId);
    const now = new Date().toISOString();

    return db.runTransaction(async (tx) => {
      const [membershipSnap, jobSnap] = await Promise.all([
        tx.get(membershipRef),
        tx.get(jobRef),
      ]);
      if (!membershipSnap.exists)
        throw new HttpsError("not-found", "Membership not found.");
      const membership = membershipSnap.data() as Membership;
      assertTenant(user, membership.tenantId);
      if (!jobSnap.exists)
        throw new HttpsError("not-found", "Visit job not found.");
      const job = jobSnap.data() as ServiceJob;
      assertTenant(user, job.tenantId);
      if (job.customerId !== membership.customerId)
        throw new HttpsError(
          "failed-precondition",
          "This visit belongs to a different customer.",
        );
      if (job.status === "CANCELLED")
        throw new HttpsError(
          "failed-precondition",
          "This visit job was cancelled.",
        );
      // Lazy expiry, same rule as a wash-credit booking: a stale-active plan
      // past its endDate grants nothing even before the sweeper runs.
      const today = now.slice(0, 10);
      if (
        membership.status !== "active" ||
        !membership.endDate ||
        membership.endDate < today
      )
        throw new HttpsError(
          "failed-precondition",
          "Membership is not active or has expired.",
        );
      const total = membership.refreshesTotal ?? 0;
      const used = membership.refreshesUsed ?? 0;
      if (total <= 0)
        throw new HttpsError(
          "failed-precondition",
          "This plan has no interior refresh benefit.",
        );

      // Idempotent replay: one live refresh record per visit job.
      const existingSnap = await tx.get(
        db
          .collection(SUBCOLLECTIONS.membershipRefreshUsage(membership.id))
          .where("jobId", "==", job.id)
          .limit(2),
      );
      const live = existingSnap.docs
        .map((d) => d.data() as MembershipRefreshUsage)
        .filter((row) => !row.restoredAt);
      if (live.length > 0) {
        return {
          refreshUsageId: live[0]!.id,
          alreadyRecorded: true,
          refreshesUsed: used,
          refreshesTotal: total,
        };
      }

      if (used >= total)
        throw new HttpsError(
          "failed-precondition",
          "The interior refresh for this plan has already been used.",
        );

      const usageRef = db
        .collection(SUBCOLLECTIONS.membershipRefreshUsage(membership.id))
        .doc();
      const row: MembershipRefreshUsage = {
        id: usageRef.id,
        tenantId: membership.tenantId,
        membershipId: membership.id,
        customerId: membership.customerId,
        jobId: job.id,
        usedAt: now,
        usedBy: user.uid,
        restoredAt: null,
        restoredBy: null,
      };
      tx.set(usageRef, row);
      tx.update(membershipRef, { refreshesUsed: used + 1, updatedAt: now });
      writeAuditLog(tx, {
        action: "membership.refresh_used",
        entityType: "Membership",
        entityId: membership.id,
        user,
        studioId: job.studioId ?? null,
        after: {
          jobId: job.id,
          refreshUsageId: usageRef.id,
          refreshesRemaining: Math.max(0, total - (used + 1)),
        },
      });
      return {
        refreshUsageId: usageRef.id,
        alreadyRecorded: false,
        refreshesUsed: used + 1,
        refreshesTotal: total,
      };
    });
  },
);
