/**
 * Emulator tests for the membership-desk UPI claim flow.
 *
 * Policy: staff cannot see the AutoDeck account or UPI references. A UPI
 * walk-in membership sale is therefore only a CLAIM - pending membership,
 * pending payment, no reference stored - until an admin confirms it after
 * checking the account. Cash/bank behaviour is unchanged.
 *
 * Run with: pnpm test:emulator (requires the Firestore emulator).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Customer, Membership, MembershipPlan, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

process.env["USE_PAYMENT_MOCK"] = "true";

import { createWalkinMembership } from "../../functions/membership/createWalkinMembership.js";
import { confirmMembershipPayment } from "../../functions/membership/confirmMembershipPayment.js";

const db = getFirestore();
const TENANT = "mem-upi-claim-tenant";

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

function staffAuth(authUid: string) {
  return { uid: authUid, token: { role: "studio", tenantId: TENANT, studioId: "mem-upi-studio" }, rawToken: "test" };
}
function adminAuth(authUid: string) {
  return { uid: authUid, token: { role: "admin", tenantId: TENANT, studioId: null }, rawToken: "test" };
}

async function seedPlan(planId: string): Promise<MembershipPlan> {
  const now = new Date().toISOString();
  const plan: MembershipPlan = {
    id: planId,
    tenantId: TENANT,
    tier: "gold",
    name: "Gold",
    priceInPaise: 99900,
    includedWashes: 8,
    discountPercent: 10,
    freePickups: 2,
    prioritySlot: false,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTIONS.membershipPlans()).doc(planId).set(plan);
  return plan;
}

async function seedCustomer(customerId: string) {
  const now = new Date().toISOString();
  const customer: Customer = {
    id: customerId,
    tenantId: TENANT,
    authUid: customerId,
    name: "UPI Claim Customer",
    phone: "+919876500000",
    notificationPrefs: { push: true, quietMode: false },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.collection(COLLECTIONS.customers()).doc(customerId).set(customer);
}

async function readMembership(id: string): Promise<Membership> {
  return (await db.collection(COLLECTIONS.memberships()).doc(id).get()).data() as Membership;
}
async function readPayment(id: string): Promise<Payment> {
  return (await db.collection(COLLECTIONS.payments()).doc(id).get()).data() as Payment;
}

let planId: string;
beforeAll(async () => {
  planId = uid("plan");
  await seedPlan(planId);
});

describe("Membership UPI claim (staff cannot confirm UPI)", () => {
  it("staff UPI walk-in creates a PENDING membership with a PENDING payment and drops any supplied reference", async () => {
    const customerId = uid("cust");
    await seedCustomer(customerId);
    const result = (await createWalkinMembership.run({
      data: { customerId, planId, method: "upi_manual", manualReference: "UTR999888777" },
      auth: staffAuth(uid("staff")),
    } as never)) as { membershipId: string; paymentId: string; pendingClaim: boolean };

    expect(result.pendingClaim).toBe(true);
    const membership = await readMembership(result.membershipId);
    expect(membership.status).toBe("pending");
    expect(membership.activatedAt).toBeNull();
    expect(membership.activatedBy).toBeNull();
    expect(membership.startDate).toBeNull();
    expect(membership.endDate).toBeNull();

    const payment = await readPayment(result.paymentId);
    expect(payment.status).toBe("pending");
    expect(payment.method).toBe("upi_manual");
    expect(payment.manualReference).toBeNull();
    expect(payment.recordedBy).toBeNull();
    expect(payment.completedAt).toBeNull();
    expect(payment.amount).toBe(99900);
  });

  it("staff cannot confirm a UPI membership claim (permission-denied), admin confirmation activates it", async () => {
    const customerId = uid("cust");
    await seedCustomer(customerId);
    const claim = (await createWalkinMembership.run({
      data: { customerId, planId, method: "upi_manual" },
      auth: staffAuth(uid("staff")),
    } as never)) as { membershipId: string; paymentId: string };

    await expect(
      confirmMembershipPayment.run({
        data: { membershipId: claim.membershipId, method: "upi_manual", manualReference: "UTR111222333" },
        auth: staffAuth(uid("staff")),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });

    // Still pending after the refused attempt.
    expect((await readMembership(claim.membershipId)).status).toBe("pending");

    const confirmed = (await confirmMembershipPayment.run({
      data: { membershipId: claim.membershipId, method: "upi_manual", manualReference: "UTR111222333" },
      auth: adminAuth(uid("admin")),
    } as never)) as { membershipId: string; idempotent: boolean };
    expect(confirmed.idempotent).toBe(false);

    const membership = await readMembership(claim.membershipId);
    expect(membership.status).toBe("active");
    expect(membership.activatedAt).not.toBeNull();
    const payment = await readPayment(claim.paymentId);
    expect(payment.status).toBe("completed");
    expect(payment.manualReference).toBe("UTR111222333");
  });

  it("a duplicate walk-in sale is refused while the UPI claim is pending", async () => {
    const customerId = uid("cust");
    await seedCustomer(customerId);
    const auth = staffAuth(uid("staff"));
    await createWalkinMembership.run({ data: { customerId, planId, method: "upi_manual" }, auth } as never);
    await expect(
      createWalkinMembership.run({ data: { customerId, planId, method: "cash" }, auth } as never),
    ).rejects.toMatchObject({ code: "already-exists" });
  });

  it("staff cash walk-in still activates immediately with a completed payment", async () => {
    const customerId = uid("cust");
    await seedCustomer(customerId);
    const staff = staffAuth(uid("staff"));
    const result = (await createWalkinMembership.run({
      data: { customerId, planId, method: "cash", manualReference: "drawer" },
      auth: staff,
    } as never)) as { membershipId: string; paymentId: string; pendingClaim: boolean };

    expect(result.pendingClaim).toBe(false);
    const membership = await readMembership(result.membershipId);
    expect(membership.status).toBe("active");
    expect(membership.activatedBy).toBe(staff.uid);
    const payment = await readPayment(result.paymentId);
    expect(payment.status).toBe("completed");
    expect(payment.recordedBy).toBe(staff.uid);
    expect(payment.manualReference).toBe("drawer");
  });
});
