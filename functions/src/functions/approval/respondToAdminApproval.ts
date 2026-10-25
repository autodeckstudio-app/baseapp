// Admin/superadmin only. Answers a staff-to-admin approval request:
// pending -> approved or pending -> rejected, with an optional note the
// requesting staff member can read. Studio staff can never respond — the
// whole point is that the decision sits above them. Records and audits the
// decision only; it performs no financial or data mutation itself.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AdminApprovalRequest } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { respondToAdminApprovalSchema } from "../../schemas/approval.js";

export const respondToAdminApproval = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);

  const data = validate(respondToAdminApprovalSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "adminApproval.respond");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.adminApprovalRequests()).doc(data.requestId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Approval request not found.");
    const cur = snap.data() as AdminApprovalRequest;
    assertTenant(user, cur.tenantId);

    const now = new Date().toISOString();
    const note = data.note ?? null;

    // No-op guard: an identical repeat decision writes nothing and adds no
    // audit entry, so a double-tap cannot fan out duplicate records.
    if (cur.status === data.decision && cur.responseNote === note) {
      return { requestId: data.requestId, status: cur.status, idempotent: true };
    }
    if (cur.status !== "pending") {
      throw new HttpsError("failed-precondition", `This request is already ${cur.status} and cannot be changed.`);
    }

    tx.update(ref, { status: data.decision, respondedAt: now, respondedBy: user.uid, responseNote: note, updatedAt: now });
    writeAuditLog(tx, {
      action: `adminApproval.${data.decision}`,
      entityType: "AdminApprovalRequest",
      entityId: data.requestId,
      user,
      studioId: cur.studioId,
      before: { status: "pending" },
      after: { status: data.decision },
    });
    return { requestId: data.requestId, status: data.decision, idempotent: false };
  });

  return result;
});
