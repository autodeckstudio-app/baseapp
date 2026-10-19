import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { cancelWalkinJobSchema } from "../../schemas/job.js";
import { walkinCancelBlock } from "../../lib/walkin-cancel.js";

/** Cancel a walk-in that was started by mistake: unpaid, not started. Frees the bay and leaves an audit entry. */
export const cancelWalkinJob = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(cancelWalkinJobSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "job.walkinCancel");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.jobs()).doc(data.jobId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Job not found.");
    const job = snap.data() as ServiceJob;
    assertTenant(user, job.tenantId);
    if (user.claims.role === "studio" && user.claims.studioId !== job.studioId) {
      throw new HttpsError("permission-denied", "Job belongs to a different studio.");
    }
    if (job.status === "CANCELLED") return { jobId: data.jobId, alreadyCancelled: true };
    const block = walkinCancelBlock(job);
    if (block) throw new HttpsError("failed-precondition", block);

    const pays = await tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", data.jobId).where("status", "in", ["pending", "processing", "completed"]).limit(1));
    if (!pays.empty) throw new HttpsError("failed-precondition", "A payment is open on this job, so it cannot be cancelled here.");
    const approvals = await tx.get(db.collection(COLLECTIONS.approvals()).where("jobId", "==", data.jobId).where("status", "==", "pending").limit(1));
    if (!approvals.empty) throw new HttpsError("failed-precondition", "This job has an approval awaiting the customer. Resolve it first.");

    const now = new Date().toISOString();
    tx.update(ref, {
      status: "CANCELLED",
      statusHistory: [...job.statusHistory, { status: "CANCELLED", changedAt: now, changedBy: user.uid, notes: data.reason }],
      updatedAt: now,
    });
    writeAuditLog(tx, {
      action: "job.walkin_cancelled",
      entityType: "ServiceJob",
      entityId: data.jobId,
      user,
      studioId: job.studioId,
      before: { status: job.status },
      after: { status: "CANCELLED", reason: data.reason },
    });
    return { jobId: data.jobId, alreadyCancelled: false };
  });
});
