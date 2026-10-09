// Studio/admin confirms a pay-at-studio membership payment (cash / direct UPI /
// bank transfer). Atomically records the payment as completed AND activates the
// membership â one secured backend operation, so a membership can never become
// active without a completed payment record behind it. Records who confirmed
// and when. Online (razorpay_payment_link) payments are refused here: those
// complete only through backend provider verification, never a staff tap.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Membership, Payment } from "@autodeck/core";
import { MEMBERSHIP_DURATION_DAYS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { confirmMembershipPaymentSchema } from "../../schemas/membership.js";

export const confirmMembershipPayment = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");

  const data = validate(confirmMembershipPaymentSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "membership.confirmPayment");

  const db = getFirestore();
  const membershipRef = db.collection(COLLECTIONS.memberships()).doc(data.membershipId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(membershipRef);
    if (!snap.exists) throw new HttpsError("not-found", "Membership not found.");
    const membership = snap.data() as Membership;
    assertTenant(user, membership.tenantId);

    const paySnap = await tx.get(
      db
        .collection(COLLECTIONS.payments())
        .where("membershipId", "==", data.membershipId)
        .where("status", "in", ["pending", "processing", "completed"])
        .limit(1),
    );
    const payDoc = paySnap.docs[0];
    const payment = payDoc?.data() as Payment | undefined;

    // Idempotent replay: already confirmed â report success without new
    // writes, so a double-tap cannot duplicate audit entries or notifications.
    if (membership.status === "active" && payment?.status === "completed") {
      return { membershipId: data.membershipId, idempotent: true };
    }
    if (membership.status !== "pending") {
      throw new HttpsError("failed-precondition", `Cannot confirm payment for a ${membership.status} membership.`);
    }
    if (!payDoc || !payment) {
      throw new HttpsError("not-found", "No payment record exists for this membership.");
    }
    if (payment.status !== "completed" && payment.method === "razorpay_payment_link") {
      throw new HttpsError(
        "failed-precondition",
        "This is an online payment. It is confirmed automatically once the payment provider verifies it - it cannot be marked paid manually.",
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const startDate = nowIso.slice(0, 10);
    const endDate = new Date(now.getTime() + MEMBERSHIP_DURATION_DAYS * 86400000).toISOString().slice(0, 10);

    if (payment.status !== "completed") {
      tx.update(payDoc.ref, {
        status: "completed",
        method: data.method,
        manualReference: data.manualReference ?? null,
        recordedBy: user.uid,
        completedAt: nowIso,
        updatedAt: nowIso,
      });
      writeAuditLog(tx, {
        action: "payment.completed",
        entityType: "Payment",
        entityId: payDoc.id,
        user,
        studioId: null,
        after: { status: "completed", targetType: "membership", membershipId: data.membershipId, method: data.method },
      });
    }

    tx.update(membershipRef, {
      status: "active",
      startDate,
      endDate,
      activatedAt: nowIso,
      activatedBy: user.uid,
      updatedAt: nowIso,
    });
    writeAuditLog(tx, {
      action: "membership.activated",
      entityType: "Membership",
      entityId: data.membershipId,
      user,
      studioId: null,
      before: { status: membership.status },
      after: { status: "active", startDate, endDate, via: "payment_confirmed" },
    });

    return { membershipId: data.membershipId, idempotent: false };
  });
});
