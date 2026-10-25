// Studio staff (or an admin) files a request for an ADMIN decision — the
// staff-to-admin counterpart of the customer additional-work approval, which
// lives in createApproval.ts and is preserved unchanged. An approval here
// authorizes nothing by itself: it is a recorded, audited admin answer the
// staff member can see, never a charge, refund, discount or price change.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { AdminApprovalRequest } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { requestAdminApprovalSchema } from "../../schemas/approval.js";

export const requestAdminApproval = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);

  const data = validate(requestAdminApprovalSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "adminApproval.request");

  if (data.targetType === "none" && data.targetId) {
    throw new HttpsError("invalid-argument", 'A request about nothing specific cannot carry a target.');
  }
  if (data.targetType !== "none" && !data.targetId) {
    throw new HttpsError("invalid-argument", "This kind of request needs the job, booking or pickup request it is about.");
  }

  const db = getFirestore();

  // The target must exist and belong to the caller's tenant (and studio, for
  // studio staff) — a request must never reference another tenant's records.
  if (data.targetType !== "none" && data.targetId) {
    const collection =
      data.targetType === "job"
        ? COLLECTIONS.jobs()
        : data.targetType === "booking"
          ? COLLECTIONS.bookings()
          : COLLECTIONS.pickupRequests();
    const snap = await db.collection(collection).doc(data.targetId).get();
    if (!snap.exists) throw new HttpsError("not-found", "The record this request is about was not found.");
    const target = snap.data() as { tenantId?: string; studioId?: string };
    if (!target.tenantId) throw new HttpsError("internal", "The linked record has no tenant.");
    assertTenant(user, target.tenantId);
    if (user.claims.role === "studio" && target.studioId && user.claims.studioId !== target.studioId) {
      throw new HttpsError("permission-denied", "That record belongs to a different studio.");
    }
  }

  const now = new Date().toISOString();
  const ref = db.collection(COLLECTIONS.adminApprovalRequests()).doc();
  const doc: AdminApprovalRequest = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    studioId: user.claims.studioId ?? "",
    targetType: data.targetType,
    targetId: data.targetType === "none" ? null : (data.targetId ?? null),
    reason: data.reason,
    amountPaise: data.amountPaise ?? null,
    requestedBy: user.uid,
    status: "pending",
    respondedAt: null,
    respondedBy: null,
    responseNote: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(ref, doc);
    writeAuditLog(tx, {
      action: "adminApproval.requested",
      entityType: "AdminApprovalRequest",
      entityId: ref.id,
      user,
      studioId: doc.studioId,
      after: { targetType: doc.targetType, targetId: doc.targetId, amountPaise: doc.amountPaise },
    });
  });

  return { requestId: ref.id };
});
