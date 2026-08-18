// Studio/admin only. Withdraws a still-pending request the studio no longer
// needs (e.g. found the issue was minor after all). Never overrides a
// customer's decision — only callable while status is still 'pending'.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ApprovalRequest } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { cancelApprovalSchema } from "../../schemas/approval.js";

export const cancelApproval = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");

  const data = validate(cancelApprovalSchema, request.data);
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.approvals()).doc(data.approvalId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Approval not found.");
    const approval = snap.data() as ApprovalRequest;

    assertTenant(user, approval.tenantId);
    if (user.claims.role === "studio" && user.claims.studioId !== approval.studioId) {
      throw new HttpsError("permission-denied", "Approval belongs to a different studio.");
    }
    if (approval.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        `Approval is already ${approval.status} and cannot be cancelled.`,
      );
    }

    const now = new Date().toISOString();
    tx.update(ref, { status: "cancelled", respondedAt: now, respondedBy: user.uid });
    writeAuditLog(tx, {
      action: "approval.cancelled",
      entityType: "ApprovalRequest",
      entityId: approval.id,
      user,
      studioId: approval.studioId,
      before: { status: "pending" },
      after: { status: "cancelled" },
    });
  });

  return { approvalId: data.approvalId };
});
