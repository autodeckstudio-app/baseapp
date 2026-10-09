// Studio/admin walk-in sale: the customer is at the studio, staff have found
// (or just created) their customer record, and cash/UPI has been received.
// Creates the membership already ACTIVE with its completed payment in one
// transaction â the same state a confirmed pay-at-studio purchase ends in.
// Records who sold it and when. Refuses when the customer already has a
// pending or active membership (direct them to the pending queue instead).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Customer, Membership, MembershipPlan, Payment } from "@autodeck/core";
import { MEMBERSHIP_DURATION_DAYS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createWalkinMembershipSchema } from "../../schemas/membership.js";

export const createWalkinMembership = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");

  const data = validate(createWalkinMembershipSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "membership.walkin");

  const db = getFirestore();
  const membershipRef = db.collection(COLLECTIONS.memberships()).doc();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();

  return db.runTransaction(async (tx) => {
    const planSnap = await tx.get(db.collection(COLLECTIONS.membershipPlans()).doc(data.planId));
    if (!planSnap.exists) throw new HttpsError("not-found", "Membership plan not found.");
    const plan = planSnap.data() as MembershipPlan;
    assertTenant(user, plan.tenantId);
    if (!plan.active) throw new HttpsError("failed-precondition", "This membership plan is not currently available.");

    const customerSnap = await tx.get(db.collection(COLLECTIONS.customers()).doc(data.customerId));
    if (!customerSnap.exists) throw new HttpsError("not-found", "Customer not found.");
    const customer = customerSnap.data() as Customer;
    assertTenant(user, customer.tenantId);

    const existingSnap = await tx.get(
      db
        .collection(COLLECTIONS.memberships())
        .where("tenantId", "==", user.claims.tenantId)
        .where("customerId", "==", data.customerId)
        .where("status", "in", ["pending", "active"])
        .limit(1),
    );
    if (!existingSnap.empty) {
      throw new HttpsError(
        "already-exists",
        "This customer already has a pending or active membership. Confirm the pending one instead of creating a duplicate.",
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const startDate = nowIso.slice(0, 10);
    const endDate = new Date(now.getTime() + MEMBERSHIP_DURATION_DAYS * 86400000).toISOString().slice(0, 10);

    const membership: Membership = {
      id: membershipRef.id,
      tenantId: user.claims.tenantId,
      customerId: data.customerId,
      planId: plan.id,
      tier: plan.tier,
      status: "active",
      washesTotal: plan.includedWashes,
      washesUsed: 0,
      discountPercent: plan.discountPercent,
      startDate,
      endDate,
      activatedAt: nowIso,
      activatedBy: user.uid,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const payment: Payment = {
      id: paymentRef.id,
      tenantId: user.claims.tenantId,
      studioId: null,
      targetType: "membership",
      jobId: null,
      bookingId: null,
      membershipId: membershipRef.id,
      customerId: data.customerId,
      amount: plan.priceInPaise,
      currency: "INR",
      method: data.method,
      status: "completed",
      razorpayPaymentLinkId: null,
      razorpayPaymentId: null,
      razorpayOrderId: null,
      razorpayRefundId: null,
      refundAmount: null,
      manualReference: data.manualReference ?? null,
      recordedBy: user.uid,
      invoiceId: null,
      providerEventId: null,
      completedAt: nowIso,
      failedAt: null,
      cancelledAt: null,
      refundedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    tx.set(membershipRef, membership);
    tx.set(paymentRef, payment);
    writeAuditLog(tx, {
      action: "membership.purchased",
      entityType: "Membership",
      entityId: membershipRef.id,
      user,
      studioId: null,
      after: { planId: plan.id, tier: plan.tier, priceInPaise: plan.priceInPaise, paymentId: paymentRef.id, via: "walkin" },
    });
    writeAuditLog(tx, {
      action: "payment.completed",
      entityType: "Payment",
      entityId: paymentRef.id,
      user,
      studioId: null,
      after: { status: "completed", targetType: "membership", membershipId: membershipRef.id, method: data.method },
    });
    writeAuditLog(tx, {
      action: "membership.activated",
      entityType: "Membership",
      entityId: membershipRef.id,
      user,
      studioId: null,
      after: { status: "active", startDate, endDate, via: "walkin" },
    });

    return { membershipId: membershipRef.id, paymentId: paymentRef.id };
  });
});
