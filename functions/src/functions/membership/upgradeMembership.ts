import { assertMembershipIdentityCompatible } from "../../lib/membership-identity-compat.js";
import { requireCustomerDocId } from "../../lib/customer-identity.js";
// Customer upgrades an active membership to a dearer plan: pays only the price difference; on payment the old plan ends
// (unused washes forfeited, nothing carried over) and the new plan starts a fresh 30-day term. Price rule in core upgradePricePaise (owner rule relayed by the parent, 18 Oct): difference if nothing used, else the full new price.
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
import {
  extractCustomerUser,
  assertRole,
  assertTenant,
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { upgradeMembershipSchema } from "../../schemas/membership.js";
import { membershipPaymentUrl } from "../../lib/membership-payment-url.js";
import { obtainMembershipPaymentLink } from "../../lib/membership-payment-link.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { upgradePricePaise } from "@autodeck/core";
import { freshGrant } from "../../lib/membership-grant.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const upgradeMembership = onCall(
  {
    region: "asia-south1",
    secrets: [
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
    ],
    enforceAppCheck: shouldEnforceAppCheck(),
  },
  async (request) => {
    const user = extractCustomerUser(request);
    assertRole(user, "customer");

    const data = validate(upgradeMembershipSchema, request.data);
    await enforceRateLimit(subjectFrom(user), "membership.upgrade");

    const db = getFirestore();
    const customerId = await requireCustomerDocId(
      db,
      COLLECTIONS.customers(),
      user.claims.tenantId,
      user.uid,
    );

    await assertMembershipIdentityCompatible(
      db,
      user.claims.tenantId,
      user.uid,
      customerId,
    );
    const planSnap = await db
      .collection(COLLECTIONS.membershipPlans())
      .doc(data.planId)
      .get();
    if (!planSnap.exists)
      throw new HttpsError("not-found", "Membership plan not found.");
    const plan = planSnap.data() as MembershipPlan;
    assertTenant(user, plan.tenantId);
    if (!plan.active) {
      throw new HttpsError(
        "failed-precondition",
        "This membership plan is not currently available.",
      );
    }

    // Upgrade needs exactly one active plan, and the new plan must cost more. The price is only the difference.
    const activeSnap = await db
      .collection(COLLECTIONS.memberships())
      .where("tenantId", "==", user.claims.tenantId)
      .where("customerId", "==", customerId)
      .where("status", "in", ["pending", "active"])
      .get();
    const activeDoc = activeSnap.docs.find(
      (d) => (d.data() as Membership).status === "active",
    );
    if (!activeDoc)
      throw new HttpsError(
        "failed-precondition",
        "You need an active plan to upgrade. Choose a plan instead.",
      );
    const current = activeDoc.data() as Membership;
    const pending = activeSnap.docs
      .map((d) => d.data() as Membership)
      .find((m) => m.status === "pending");
    if (pending) {
      // Idempotent replay of the same upgrade, never a second one.
      if (pending.upgradeFromMembershipId !== current.id)
        throw new HttpsError(
          "already-exists",
          "A plan purchase is already in progress for you.",
        );
      const paymentSnap = await db
        .collection(COLLECTIONS.payments())
        .where("membershipId", "==", pending.id)
        .where("status", "in", ["pending", "processing", "completed"])
        .limit(1)
        .get();
      const existingPayment = paymentSnap.docs[0]?.data() as
        Payment | undefined;
      return {
        membershipId: pending.id,
        paymentId: existingPayment?.id ?? null,
        paymentUrl: await membershipPaymentUrl(
          db,
          existingPayment,
          user.phone ?? "",
        ),
      };
    }
    const currentPlanSnap = await db
      .collection(COLLECTIONS.membershipPlans())
      .doc(current.planId)
      .get();
    if (!currentPlanSnap.exists)
      throw new HttpsError(
        "failed-precondition",
        "Your current plan could not be read. Contact the studio.",
      );
    const difference = upgradePricePaise({
      currentPlanPricePaise: (currentPlanSnap.data() as MembershipPlan)
        .priceInPaise,
      newPlanPricePaise: plan.priceInPaise,
      washesUsed: current.washesUsed,
      pickupsUsed: current.pickupsUsed ?? 0,
    });
    if (difference === null)
      throw new HttpsError(
        "failed-precondition",
        "Choose a plan that costs more than your current one.",
      );

    const now = new Date().toISOString();
    const membershipRef = db.collection(COLLECTIONS.memberships()).doc();
    const paymentRef = db.collection(COLLECTIONS.payments()).doc();

    let paymentUrl: string | null = null;
    const razorpayPaymentLinkId: string | null = null;
    const razorpayOrderId: string | null = null;

    const membership: Membership = {
      id: membershipRef.id,
      tenantId: user.claims.tenantId,
      customerId,
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
      customerId,
      amount: difference,
      currency: "INR",
      method: data.method,
      status: "pending",
      paymentUrl,
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
      await assertMembershipIdentityCompatible(
        db,
        user.claims.tenantId,
        user.uid,
        customerId,
        tx,
      );
      // Authoritative re-check inside the transaction — two concurrent
      // purchase calls for the same customer must not both pass the
      // pre-check above and each create a separate Membership + Payment.
      const freshSnap = await tx.get(
        db
          .collection(COLLECTIONS.memberships())
          .where("tenantId", "==", user.claims.tenantId)
          .where("customerId", "==", customerId)
          .where("status", "==", "pending")
          .limit(1),
      );
      if (!freshSnap.empty)
        throw new HttpsError(
          "already-exists",
          "A plan purchase is already in progress for you.",
        );
      const stillActive = await tx.get(activeDoc.ref);
      if (
        !stillActive.exists ||
        (stillActive.data() as Membership).status !== "active"
      )
        throw new HttpsError(
          "failed-precondition",
          "Your plan changed. Try again.",
        );

      // Read the shared claim before writing: blind writes do not conflict-check
      // competing first upgrades that leave the active predecessor unchanged.
      const claimRef = db
        .collection("membershipClaims")
        .doc(`${user.claims.tenantId}_${customerId}`);
      const claim = await tx.get(claimRef);
      const heldId = claim.exists
        ? (claim.data() as { membershipId?: string }).membershipId
        : null;
      if (heldId && heldId !== activeDoc.id) {
        const held = await tx.get(
          db.collection(COLLECTIONS.memberships()).doc(heldId),
        );
        if (
          held.exists &&
          ["pending", "active"].includes((held.data() as Membership).status)
        )
          throw new HttpsError(
            "already-exists",
            "A plan purchase is already in progress for you.",
          );
      }

      // Shared per-customer claim (the same document purchaseMembership
      // writes): a concurrent purchase, walkin creation, or a refund-restore of
      // the plan being upgraded touches this document and conflict-retries
      // instead of racing this creation.
      tx.set(
        db
          .collection("membershipClaims")
          .doc(`${user.claims.tenantId}_${customerId}`),
        {
          tenantId: user.claims.tenantId,
          customerId,
          membershipId: membershipRef.id,
          updatedAt: now,
        },
      );
      tx.set(membershipRef, membership);
      tx.set(paymentRef, payment);
      writeAuditLog(tx, {
        action: "membership.upgrade_requested",
        entityType: "Membership",
        entityId: membershipRef.id,
        user,
        studioId: null,
        after: {
          planId: plan.id,
          tier: plan.tier,
          fromMembershipId: current.id,
          differencePaise: difference,
          paymentId: paymentRef.id,
        },
      });
    });

    if (data.method === "razorpay_payment_link") {
      const stored = (await paymentRef.get()).data() as Payment;
      const link = await obtainMembershipPaymentLink(
        db,
        stored,
        getPaymentProvider(),
        user.phone ?? "",
      );
      paymentUrl = link.outcome === "link_ready" ? link.paymentUrl : null;
    }
    return {
      membershipId: membershipRef.id,
      paymentId: paymentRef.id,
      paymentUrl,
    };
  },
);
