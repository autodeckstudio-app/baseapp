// Studio/admin only. The additional work is always an existing catalogue
// Service selected by staff — never a free-typed price — so the price is
// always computed by the same pricing engine used for bookings, never
// trusted from the client (Phase 3 requirement).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob, Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createApprovalSchema } from "../../schemas/approval.js";
import { buildApproval } from "../../lib/approval-builder.js";

export const createApproval = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");

  const data = validate(createApprovalSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "approval.create");
  const quantity = data.quantity ?? 1;

  const db = getFirestore();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
  const job = jobSnap.data() as ServiceJob;

  assertTenant(user, job.tenantId);
  if (user.claims.role === "studio" && user.claims.studioId !== job.studioId) {
    throw new HttpsError("permission-denied", "Job belongs to a different studio.");
  }
  if (job.status === "DELIVERED" || job.status === "CANCELLED") {
    throw new HttpsError("failed-precondition", `Cannot request approval on a job that is ${job.status}.`);
  }

  const serviceSnap = await db.collection(COLLECTIONS.services()).doc(data.serviceId).get();
  if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
  const service = serviceSnap.data() as Service;
  assertTenant(user, service.tenantId);
  if (!service.active) throw new HttpsError("failed-precondition", "Service is not active.");

  const now = new Date().toISOString();
  const ref = db.collection(COLLECTIONS.approvals()).doc();

  // Server-authoritative price snapshot — never trust a client-supplied
  // final price. Built once here so it's identical to what's persisted.
  const approval = buildApproval({
    id: ref.id,
    job,
    service,
    quantity,
    reason: data.reason,
    requestedBy: user.uid,
    createdAt: now,
  });

  await db.runTransaction(async (tx) => {
    // Financial integrity guard: no existing architecture supports charging
    // an additional amount once a payment is already in flight or settled
    // for this job — no recharge/refund model exists, and none is invented
    // here (Phase 3 explicit scope boundary — see HANDOFF).
    const inFlight = await tx.get(
      db
        .collection(COLLECTIONS.payments())
        .where("jobId", "==", data.jobId)
        .where("status", "in", ["pending", "processing", "completed"])
        .limit(1),
    );
    if (!inFlight.empty) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot request additional-work approval once payment has been initiated or completed for this job.",
      );
    }

    tx.set(ref, approval);
    writeAuditLog(tx, {
      action: "approval.created",
      entityType: "ApprovalRequest",
      entityId: ref.id,
      user,
      studioId: job.studioId,
      after: { jobId: job.id, serviceName: service.name, priceImpact: approval.priceImpact, newTotal: approval.newTotal },
    });
  });

  return { approvalId: ref.id };
});
