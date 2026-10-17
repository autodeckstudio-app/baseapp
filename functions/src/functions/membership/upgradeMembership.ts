// Customer upgrades an active membership to a dearer plan: pays only the price difference; on payment the old plan ends
// (unused washes forfeited, nothing carried over) and the new plan starts a fresh 30-day term. Terms relayed by the parent from the owner on 18 Oct (not independently verified by me).
// Original header of the purchase flow this is based on: Customer requests a membership plan. Creates a Membership in 'pending' status
// plus a Payment record (targetType: "membership") using the same financial
// architecture as job payments (Payment status machine, PaymentProvider).
// Activation is a SEPARATE admin-only step (activateMembership) — payment
// completing does not itself activate the membership (doc08 §8.2 Admin
// "Special powers: Activate or cancel memberships"; doc16 §16.3).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Membership, MembershipPlan, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { upgradeMembershipSchema } from "../../schemas/membership.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { upgradePricePaise, washesLostOnUpgrade } from "@autodeck/core";
import { freshGrant } from "../../lib/membership-grant.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

export const upgradeMembership = onCall({ region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"] }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");

  const data = validate(upgradeMembershipSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "membership.upgrade");

  const db = getFirestore();

  const planSnap = await db.collection(COLLECTIONS.membershipPlans()).doc(data.planId).get();
  if (!planSnap.exists) throw new HttpsError("not-found", "Membership plan not found.");
  const plan = planSnap.data() as MembershipPlan;
  assertTenant(user, plan.tenantId);
  if (!plan.active) {
    throw new HttpsError("failed-precondition", "This membership plan is not currently available.");
  }

  // Upgrade needs exactly one active plan, and the new plan must cost more. The price is only the difference.
  const activeSnap = await db
    .collection(COLLECTIONS.memberships())
    .where("tenantId", "==", user.claims.tenantId)
    .where("customerId", "==", user.uid)
    .where("status", "in", ["pending", "active"])
    .get();
  const activeDoc = activeSnap.docs.find((d) => (d.data() as Membership).status === "active");
  if (!activeDoc) throw new HttpsError("failed-precondition", "You need an active plan to upgrade. Choose a plan instead.");
  const current = activeDoc.data() as Membership;
  const pending = activeSnap.docs.map((d) => d.data() as Membership).find((m) => m.status === "pending");
  if (pending) {
    // Idempotent replay of the same upgrade, never a second one.
    if (pending.upgradeFromMembershipId !== current.id) throw new HttpsError("already-exists", "A plan purchase is already in progress for you.");
    const paymentSnap = await db.collection(COLLECTIONS.payments()).where("membershipId", "==", pending.id).where("status", "in", ["pending", "processing", "completed"]).limit(1).get();
    return { membershipId: pending.id, paymentId: (paymentSnap.docs[0]?.data() as Payment | undefined)?.id ?? null, paymentUrl: null };
  }
  const currentPlanSnap = await db.collection(COLLECTIONS.membershipPlans()).doc(current.planId).get();
  if (!currentPlanSnap.exists) throw new HttpsError("failed-precondition", "Your current plan could not be read. Contact the studio.");
  const difference = upgradePricePaise({ currentPlanPricePaise: (currentPlanSnap.data() as MembershipPlan).priceInPaise, newPlanPricePaise: plan.priceInPaise, unusedWashes: washesLostOnUpgrade(current) });
  if (difference === null) throw new HttpsError("failed-precondition", "Choose a plan that costs more than your current one.");

  const now = new Date().toISOString();
  const membershipRef = db.collection(COLLECTIONS.memberships()).doc();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();

  let paymentUrl: string | null = null;
  let razorpayPaymentLinkId: string | null = null;
  let razorpayOrderId: string | null = null;

  if (data.method === "razorpay_payment_link") {
    const provider = getPaymentProvider();
    const result = await provider.createPaymentLink({
      amount: difference,
      currency: "INR",
      bookingId: membershipRef.id,
      description: `AutoDeck Membership upgrade — ${plan.name}`,
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
    ...freshGrant(plan),
    upgradeFromMembershipId: current.id,
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
    amount: difference,
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
    const freshSnap = await tx.get(db.collection(COLLECTIONS.memberships()).where("tenantId", "==", user.claims.tenantId).where("customerId", "==", user.uid).where("status", "==", "pending").limit(1));
    if (!freshSnap.empty) throw new HttpsError("already-exists", "A plan purchase is already in progress for you.");
    const stillActive = await tx.get(activeDoc.ref);
    if (!stillActive.exists || (stillActive.data() as Membership).status !== "active") throw new HttpsError("failed-precondition", "Your plan changed. Try again.");

    tx.set(membershipRef, membership);
    tx.set(paymentRef, payment);
    writeAuditLog(tx, {
      action: "membership.upgrade_requested",
      entityType: "Membership",
      entityId: membershipRef.id,
      user,
      studioId: null,
      after: { planId: plan.id, tier: plan.tier, fromMembershipId: current.id, differencePaise: difference, paymentId: paymentRef.id },
    });
  });

  return { membershipId: membershipRef.id, paymentId: paymentRef.id, paymentUrl };
});
