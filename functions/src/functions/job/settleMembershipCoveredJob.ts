import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Invoice, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { readCoveredLink, exactCoveredInvoice } from "../../lib/membership-covered.js";
import { prepareJobInvoice } from "../../lib/job-invoice.js";
export const settleMembershipCoveredJob = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const { jobId } = validate(
    z.object({ jobId: z.string().min(1).max(128) }).strict(),
    request.data,
  );
  await enforceRateLimit(subjectFrom(user), "job.settleMembershipCovered");
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const ref = db.collection(COLLECTIONS.jobs()).doc(jobId),
      snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Job not found.");
    const job = snap.data() as ServiceJob;
    if (job.tenantId !== user.claims.tenantId)
      throw new HttpsError("permission-denied", "Cross-tenant access denied.");
    assertStudio(user, job.studioId, "Job");
    const { booking, membershipId } = await readCoveredLink(db, tx, job);
    const [pays, invs, approvals] = await Promise.all([
      tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", job.id)),
      tx.get(
        db
          .collection(COLLECTIONS.invoices())
          .where("jobId", "==", job.id)
          .where("tenantId", "==", job.tenantId),
      ),
      tx.get(
        db
          .collection(COLLECTIONS.approvals())
          .where("jobId", "==", job.id)
          .where("status", "in", ["pending", "approved"]),
      ),
    ]);
    if (!pays.empty || !approvals.empty)
      throw new HttpsError(
        "failed-precondition",
        "A payment or additional work exists. Check this visit before membership settlement.",
      );
    const live = invs.docs.filter((d) => d.data()["status"] !== "void");
    const existing = live[0];
    if (
      live.length === 1 &&
      existing &&
      exactCoveredInvoice(existing.data() as Invoice, job, booking, membershipId) &&
      job.paymentStatus === "paid" &&
      booking.paymentStatus === "paid"
    )
      return { invoiceId: existing.id, alreadySettled: true };
    if (
      live.length ||
      job.settlementKind ||
      booking.settlementKind ||
      job.paymentStatus !== "unpaid" ||
      booking.paymentStatus !== "unpaid" ||
      job.status === "DELIVERED"
    )
      throw new HttpsError(
        "failed-precondition",
        "This visit is already settled or its settlement linkage is invalid.",
      );
    const prepared = await prepareJobInvoice(db, tx, job, null, membershipId);
    if (prepared.existing || prepared.invoice.total !== 0)
      throw new HttpsError(
        "failed-precondition",
        "This visit cannot issue a membership-covered invoice.",
      );
    const now = new Date().toISOString(),
      patch = {
        paymentStatus: "paid",
        settlementKind: "membership_covered",
        invoiceId: prepared.invoice.id,
        updatedAt: now,
      };
    tx.create(prepared.invoiceRef, prepared.invoice);
    tx.update(ref, patch);
    tx.update(db.collection(COLLECTIONS.bookings()).doc(booking.id), patch);
    writeAuditLog(tx, {
      action: "job.membership_covered",
      entityType: "ServiceJob",
      entityId: job.id,
      user,
      studioId: job.studioId,
      after: {
        invoiceId: prepared.invoice.id,
        settlementKind: "membership_covered",
      },
    });
    return { invoiceId: prepared.invoice.id, alreadySettled: false };
  });
});
