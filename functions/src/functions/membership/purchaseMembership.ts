// Customer requests a membership plan. Creates a Membership in 'pending' status
// plus a Payment record (targetType: "membership") using the same financial
// architecture as job payments (Payment status machine, PaymentProvider).
// Activation is a SEPARATE admin-only step (activateMembership) — payment
// completing does not itself activate the membership (doc08 §8.2 Admin
// "Special powers: Activate or cancel memberships"; doc16 §16.3).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Membership, MembershipPlan, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { purchaseMembershipSchema } from "../../schemas/membership.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

export const purchaseMembership = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");

  const data = validate(purchaseMembershipSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "membership.purchase");

  const db = getFirestore();

  const planSnap = await db.collection(COLLECTIONS.membershipPlans()).doc(data.planId).get();
  if (!planSnap.exists) throw new HttpsError("not-found", "Membership plan not found.");
  const plan = planSnap.data() as MembershipPlan;
  assertTenant(user, plan.tenantId);
  if (!plan.active) {
    throw new HttpsError("failed-precondition", "This membership plan is not currently available.");
  }

  // At most one non-terminal membership per customer at a time. Fast-fail
  // pre-check (cheap, avoids the Razorpay provider call and a transaction
  // for an obviously-invalid request) — NOT the authoritative check, since
  // it's mutable/racy across concurrent calls. See the re-check inside the
  // transaction below (Phase 7 hostile-audit finding — this was previously
  // pre-transaction-only, letting two genuinely concurrent purchase calls
  // both pass and each create a separate Membership + Payment).
  const preCheckSnap = await db
    .collection(COLLECTIONS.memberships())
    .where("tenantId", "==", user.claims.tenantId)
    .where("customerId", "==", user.uid)
    .where("status", "in", ["pending", "active"])
    .limit(1)
    .get();

  if (!preCheckSnap.empty) {
    const existing = preCheckSnap.docs[0]?.data() as Membership;
    if (existing.status === "active") {
      throw new HttpsError("already-exists", "You already have an active membership.");
    }
    // Idempotent replay: return the existing pending membership + its payment
    // rather than creating a duplicate.
    const paymentSnap = await db
      .collection(COLLECTIONS.payments())
      .where("membershipId", "==", existing.id)
      .where("status", "in", ["pending", "processing", "completed"])
      .limit(1)
      .get();
    const existingPayment = paymentSnap.docs[0]?.data() as Payment | undefined;
    return { membershipId: existing.id, paymentId: existingPayment?.id ?? null, paymentUrl: null };
  }

  const now = new Date().toISOString();
  const membershipRef = db.collection(COLLECTIONS.memberships()).doc();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();

  let paymentUrl: string | null = null;
  let razorpayPaymentLinkId: string | null = null;
  let razorpayOrderId: string | null = null;

  if (data.method === "razorpay_payment_link") {
    const provider = getPaymentProvider();
    const result = await provider.createPaymentLink({
      amount: plan.priceInPaise,
      currency: "INR",
      bookingId: membershipRef.id,
      description: `AutoDeck Membership — ${plan.name}`,
      customerName: user.email ?? user.phone ?? "Customer",
      customerPhone: user.phone ?? "",
      referenceId: paymentRef.id,
    });
    paymentUrl = result.paymentUrl;
    razorpayPaymentLinkId = result.providerPaymentLinkId;
    razorpayOrderId = result.providerOrderId;
  }

  const membership: Membership = {
    id: membershipRef.id,
    tenantId: user.claims.tenantId,
    customerId: user.uid,
    planId: plan.id,
    tier: plan.tier,
    status: "pending",
    washesTotal: plan.includedWashes,
    washesUsed: 0,
    discountPercent: plan.discountPercent,
    startDate: null,
    endDate: null,
    activatedAt: null,
    activatedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
  };

  const payment: Payment = {
    id: paymentRef.id,
    tenantId: user.claims.tenantId,
    studioId: null,
    targetType: "membership",
    jobId: null,
    bookingId: null,
    membershipId: membershipRef.id,
    customerId: user.uid,
    amount: plan.priceInPaise,
    currency: "INR",
    method: data.method,
    status: "pending",
    razorpayPaymentLinkId,
    razorpayPaymentId: null,
    razorpayOrderId,
    razorpayRefundId: null,
    refundAmount: null,
    manualReference: null,
    recordedBy: null,
    invoiceId: null,
    providerEventId: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    // Authoritative re-check inside the transaction — two concurrent
    // purchase calls for the same customer must not both pass the
    // pre-check above and each create a separate Membership + Payment.
    const freshExistingSnap = await tx.get(
      db
        .collection(COLLECTIONS.memberships())
        .where("tenantId", "==", user.claims.tenantId)
        .where("customerId", "==", user.uid)
        .where("status", "in", ["pending", "active"])
        .limit(1),
    );
    if (!freshExistingSnap.empty) {
      throw new HttpsError(
        "already-exists",
        "A membership purchase is already in progress or active for this customer.",
      );
    }

    tx.set(membershipRef, membership);
    tx.set(paymentRef, payment);
    writeAuditLog(tx, {
      action: "membership.purchased",
      entityType: "Membership",
      entityId: membershipRef.id,
      user,
      studioId: null,
      after: { planId: plan.id, tier: plan.tier, priceInPaise: plan.priceInPaise, paymentId: paymentRef.id },
    });
  });

  return { membershipId: membershipRef.id, paymentId: paymentRef.id, paymentUrl };
});
