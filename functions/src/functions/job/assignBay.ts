import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob, StudioConfig } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { assignBaySchema } from "../../schemas/job.js";

export const assignBay = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(assignBaySchema, request.data);

  const db = getFirestore();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
  const job = jobSnap.data() as ServiceJob;

  assertTenant(user, job.tenantId);

  if (user.claims.role === "studio" && user.claims.studioId !== job.studioId) {
    throw new HttpsError("permission-denied", "Job belongs to a different studio.");
  }

  if (job.status === "DELIVERED" || job.status === "CANCELLED") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot reassign bay for a job with status '${job.status}'.`,
    );
  }

  // Verify the new bay exists and is compatible
  const configSnap = await db.collection(COLLECTIONS.studioConfig()).doc(job.studioId).get();
  if (!configSnap.exists) throw new HttpsError("not-found", "Studio config not found.");
  const config = configSnap.data() as StudioConfig;

  const bay = config.bays.find((b) => b.id === data.bayId);
  if (!bay) throw new HttpsError("not-found", "Bay not found in studio configuration.");
  if (!bay.active) throw new HttpsError("failed-precondition", "Target bay is not active.");

  const previousBayId = job.bayId;
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    tx.update(db.collection(COLLECTIONS.jobs()).doc(data.jobId), {
      bayId: data.bayId,
      updatedAt: now,
    });

    // Also update the linked booking's bayId
    if (job.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), {
        bayId: data.bayId,
        updatedAt: now,
      });
    }

    writeAuditLog(tx, {
      action: "job.bay_reassigned",
      entityType: "ServiceJob",
      entityId: data.jobId,
      user,
      studioId: job.studioId,
      before: { bayId: previousBayId },
      after: { bayId: data.bayId, reason: data.reason ?? null },
    });
  });

  return { jobId: data.jobId, previousBayId, newBayId: data.bayId };
});
