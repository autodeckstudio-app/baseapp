// Customer only. The sole state transition a customer can drive:
// PENDING -> APPROVED or PENDING -> REJECTED, on their own approval only.
// Approving increments ServiceJob.additionalWorkDelta/totalAmount — the
// original Booking/Job priceBreakdown snapshot is never rewritten
// (doc06 §6.4 Rule 1). Rejecting authorizes nothing; original work
// continues unaffected.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ApprovalRequest, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { respondToApprovalSchema } from "../../schemas/approval.js";

export const respondToApproval = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");

  const data = validate(respondToApprovalSchema, request.data);
  const db = getFirestore();
  const approvalRef = db.collection(COLLECTIONS.approvals()).doc(data.approvalId);

  let expired = false;

  await db.runTransaction(async (tx) => {
    const approvalSnap = await tx.get(approvalRef);
    if (!approvalSnap.exists) throw new HttpsError("not-found", "Approval not found.");
    const approval = approvalSnap.data() as ApprovalRequest;

    assertTenant(user, approval.tenantId);
    if (approval.customerId !== user.uid) {
      throw new HttpsError("permission-denied", "Cannot respond to another customer's approval.");
    }
    if (approval.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        `Approval is already ${approval.status} and cannot be changed.`,
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    if (new Date(approval.expiresAt).getTime() < now.getTime()) {
      // Lazily flip to expired rather than silently processing a stale
      // decision. Cannot also throw here — a thrown transaction discards
      // all staged writes — so we flag it and throw after commit instead.
      tx.update(approvalRef, { status: "expired" });
      writeAuditLog(tx, {
        action: "approval.expired",
        entityType: "ApprovalRequest",
        entityId: approval.id,
        user,
        studioId: approval.studioId,
        before: { status: "pending" },
        after: { status: "expired" },
      });
      expired = true;
      return;
    }

    const jobRef = db.collection(COLLECTIONS.jobs()).doc(approval.jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
    const job = jobSnap.data() as ServiceJob;

    // The underlying job (or its booking) may have been cancelled while this
    // approval was still pending — there is nothing left to authorize.
    // Studio/admin can still resolve the orphaned request via cancelApproval;
    // the customer cannot approve/reject a decision that no longer applies.
    if (job.status === "CANCELLED") {
      throw new HttpsError("failed-precondition", "This job has been cancelled — the approval no longer applies.");
    }

    if (data.decision === "approved") {
      // Re-checked at decision time too — a payment could have been
      // initiated after the request was created (no recharge/refund model
      // exists to reconcile that; see createApproval.ts and HANDOFF).
      const inFlight = await tx.get(
        db
          .collection(COLLECTIONS.payments())
          .where("jobId", "==", approval.jobId)
          .where("status", "in", ["pending", "processing", "completed"])
          .limit(1),
      );
      if (!inFlight.empty) {
        throw new HttpsError(
          "failed-precondition",
          "This job now has a payment in progress — contact the studio to authorize this work.",
        );
      }

      tx.update(jobRef, {
        additionalWorkDelta: job.additionalWorkDelta + approval.priceImpact,
        totalAmount: job.totalAmount + approval.priceImpact,
        updatedAt: nowIso,
      });
      tx.update(approvalRef, { status: "approved", respondedAt: nowIso, respondedBy: user.uid });
      writeAuditLog(tx, {
        action: "approval.approved",
        entityType: "ApprovalRequest",
        entityId: approval.id,
        user,
        studioId: approval.studioId,
        before: { status: "pending", jobTotalAmount: job.totalAmount },
        after: { status: "approved", jobTotalAmount: job.totalAmount + approval.priceImpact },
      });
    } else {
      tx.update(approvalRef, { status: "rejected", respondedAt: nowIso, respondedBy: user.uid });
      writeAuditLog(tx, {
        action: "approval.rejected",
        entityType: "ApprovalRequest",
        entityId: approval.id,
        user,
        studioId: approval.studioId,
        before: { status: "pending" },
        after: { status: "rejected" },
      });
    }
  });

  if (expired) throw new HttpsError("failed-precondition", "This approval has expired.");
  return { approvalId: data.approvalId, decision: data.decision };
});
