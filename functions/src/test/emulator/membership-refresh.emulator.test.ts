/**
 * Emulator integration tests for the Platinum interior refresh benefit
 * (owner-approved ladder 18 Nov 2026, kept 19 Nov).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 * Same in-process `.run({ data, auth } as never)` pattern as
 * membership.emulator.test.ts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type {
  Membership,
  MembershipRefreshUsage,
  ServiceJob,
} from "@autodeck/core";

process.env["USE_PAYMENT_MOCK"] = "true";

import { createMembershipPlan } from "../../functions/membership/createMembershipPlan.js";
import { updateMembershipPlan } from "../../functions/membership/updateMembershipPlan.js";
import { purchaseMembership } from "../../functions/membership/purchaseMembership.js";
import { recordMembershipRefresh } from "../../functions/membership/recordMembershipRefresh.js";
import { restoreMembershipRefresh } from "../../functions/membership/restoreMembershipRefresh.js";
import { getMembershipUsage } from "../../functions/membership/getMembershipUsage.js";
import { confirmPaymentMock } from "../../functions/payment/confirmPaymentMock.js";

const db = getFirestore();

const TENANT = "refresh-tenant";
const STUDIO_ID = "refresh-studio";

function customerAuth(authUid: string) {
  return { uid: authUid, token: { role: "customer", tenantId: TENANT, studioId: null }, rawToken: "test" };
}
function adminAuth(authUid: string) {
  return { uid: authUid, token: { role: "admin", tenantId: TENANT, studioId: null }, rawToken: "test" };
}
function studioAuth(authUid: string) {
  return { uid: authUid, token: { role: "studio", tenantId: TENANT, studioId: STUDIO_ID }, rawToken: "test" };
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

async function seedCustomerProfile(id: string) {
  await db.collection("customers").doc(id).set({ id, authUid: id, tenantId: TENANT, deletedAt: null }, { merge: true });
}

async function seedJob(jobId: string, customerId: string, status: ServiceJob["status"] = "IN_PROGRESS") {
  const now = new Date().toISOString();
  await db.collection("jobs").doc(jobId).set({
    id: jobId,
    tenantId: TENANT,
    studioId: STUDIO_ID,
    customerId,
    status,
    statusHistory: [{ status, changedAt: now, changedBy: "test", notes: null }],
    createdAt: now,
    updatedAt: now,
  });
}

async function purchaseAndActivate(customerUid: string, planId: string, adminUid: string): Promise<Membership> {
  await seedCustomerProfile(customerUid);
  const purchase = (await purchaseMembership.run({
    data: { planId, method: "cash", idempotencyKey: uid("idem") },
    auth: customerAuth(customerUid),
  } as never)) as { membershipId: string; paymentId: string };
  await confirmPaymentMock.run({
    data: { paymentId: purchase.paymentId, mockResult: "success" },
    auth: adminAuth(adminUid),
  } as never);
  const snap = await db.collection("memberships").doc(purchase.membershipId).get();
  return snap.data() as Membership;
}

async function refreshRows(membershipId: string): Promise<MembershipRefreshUsage[]> {
  const snap = await db.collection(`memberships/${membershipId}/refreshUsage`).get();
  return snap.docs.map((d) => d.data() as MembershipRefreshUsage);
}

describe("Membership interior refresh benefit", () => {
  const adminUid = uid("admin");
  const staffUid = uid("staff");
  let platinumPlanId: string;
  let starterPlanId: string;

  beforeAll(async () => {
    const platinum = (await createMembershipPlan.run({
      data: {
        tier: "platinum",
        name: "Platinum",
        priceInPaise: 300000,
        includedWashes: 8,
        discountPercent: 0,
        freePickups: 3,
        prioritySlot: true,
        includedInteriorRefreshes: 1,
      },
      auth: adminAuth(adminUid),
    } as never)) as { plan: { id: string } };
    platinumPlanId = platinum.plan.id;
    const starter = (await createMembershipPlan.run({
      data: { tier: "starter", name: "Starter", priceInPaise: 90000, includedWashes: 2, discountPercent: 0 },
      auth: adminAuth(adminUid),
    } as never)) as { plan: { id: string } };
    starterPlanId = starter.plan.id;
  });

  it("plan create/update carries the refresh field; a plan without it defaults to none", async () => {
    const platinum = (await db.collection("membershipPlans").doc(platinumPlanId).get()).data();
    expect(platinum?.["includedInteriorRefreshes"]).toBe(1);
    const starter = (await db.collection("membershipPlans").doc(starterPlanId).get()).data();
    expect(starter?.["includedInteriorRefreshes"]).toBe(0);

    await updateMembershipPlan.run({
      data: { planId: starterPlanId, includedInteriorRefreshes: 2 },
      auth: adminAuth(adminUid),
    } as never);
    const updated = (await db.collection("membershipPlans").doc(starterPlanId).get()).data();
    expect(updated?.["includedInteriorRefreshes"]).toBe(2);
    // null means "leave unchanged" (callable wire encoding of an omitted field).
    await updateMembershipPlan.run({
      data: { planId: starterPlanId, includedInteriorRefreshes: null, priceInPaise: 90000 },
      auth: adminAuth(adminUid),
    } as never);
    const afterNull = (await db.collection("membershipPlans").doc(starterPlanId).get()).data();
    expect(afterNull?.["includedInteriorRefreshes"]).toBe(2);
    await updateMembershipPlan.run({
      data: { planId: starterPlanId, includedInteriorRefreshes: 0 },
      auth: adminAuth(adminUid),
    } as never);
  });

  it("purchase snapshots the plan's refresh benefit onto the membership", async () => {
    const cust = uid("cust-snap");
    const membership = await purchaseAndActivate(cust, platinumPlanId, adminUid);
    expect(membership.refreshesTotal).toBe(1);
    expect(membership.refreshesUsed).toBe(0);
    expect(membership.washesTotal).toBe(8);
    expect(membership.pickupsTotal).toBe(3);
    // Plan edits after purchase never rewrite the purchased snapshot.
    await updateMembershipPlan.run({
      data: { planId: platinumPlanId, includedInteriorRefreshes: 3 },
      auth: adminAuth(adminUid),
    } as never);
    const after = (await db.collection("memberships").doc(membership.id).get()).data() as Membership;
    expect(after.refreshesTotal).toBe(1);
    await updateMembershipPlan.run({
      data: { planId: platinumPlanId, includedInteriorRefreshes: 1 },
      auth: adminAuth(adminUid),
    } as never);
  });

  it("staff record one refresh against a visit job; replay does not double-consume", async () => {
    const cust = uid("cust-use");
    const membership = await purchaseAndActivate(cust, platinumPlanId, adminUid);
    const jobId = uid("job");
    await seedJob(jobId, cust);

    const first = (await recordMembershipRefresh.run({
      data: { membershipId: membership.id, jobId },
      auth: studioAuth(staffUid),
    } as never)) as { refreshUsageId: string; alreadyRecorded: boolean; refreshesUsed: number };
    expect(first.alreadyRecorded).toBe(false);
    expect(first.refreshesUsed).toBe(1);

    const replay = (await recordMembershipRefresh.run({
      data: { membershipId: membership.id, jobId },
      auth: studioAuth(staffUid),
    } as never)) as { refreshUsageId: string; alreadyRecorded: boolean; refreshesUsed: number };
    expect(replay.alreadyRecorded).toBe(true);
    expect(replay.refreshUsageId).toBe(first.refreshUsageId);

    const after = (await db.collection("memberships").doc(membership.id).get()).data() as Membership;
    expect(after.refreshesUsed).toBe(1);
    const rows = await refreshRows(membership.id);
    expect(rows.length).toBe(1);
    expect(rows[0]?.usedBy).toBe(staffUid);
    expect(rows[0]?.restoredAt).toBeNull();

    // The benefit is now exhausted: a second visit job cannot consume another.
    const job2 = uid("job");
    await seedJob(job2, cust);
    await expect(
      recordMembershipRefresh.run({
        data: { membershipId: membership.id, jobId: job2 },
        auth: studioAuth(staffUid),
      } as never),
    ).rejects.toThrow(/already been used/);

    // Refresh rows surface in getMembershipUsage beside, never inside, wash usage.
    const usage = (await getMembershipUsage.run({
      data: { membershipId: membership.id },
      auth: customerAuth(cust),
    } as never)) as { usage: unknown[]; refreshUsage: MembershipRefreshUsage[] };
    expect(usage.refreshUsage.length).toBe(1);
    expect(usage.refreshUsage[0]?.jobId).toBe(jobId);
    expect(usage.usage.length).toBe(0);
  });

  it("rejects wrong-customer jobs, cancelled jobs, customer callers and plans without the benefit", async () => {
    const cust = uid("cust-guard");
    const other = uid("cust-other");
    await seedCustomerProfile(other);
    const membership = await purchaseAndActivate(cust, platinumPlanId, adminUid);

    const otherJob = uid("job");
    await seedJob(otherJob, other);
    await expect(
      recordMembershipRefresh.run({
        data: { membershipId: membership.id, jobId: otherJob },
        auth: studioAuth(staffUid),
      } as never),
    ).rejects.toThrow(/different customer/);

    const cancelledJob = uid("job");
    await seedJob(cancelledJob, cust, "CANCELLED");
    await expect(
      recordMembershipRefresh.run({
        data: { membershipId: membership.id, jobId: cancelledJob },
        auth: studioAuth(staffUid),
      } as never),
    ).rejects.toThrow(/cancelled/);

    const jobId = uid("job");
    await seedJob(jobId, cust);
    await expect(
      recordMembershipRefresh.run({
        data: { membershipId: membership.id, jobId },
        auth: customerAuth(cust),
      } as never),
    ).rejects.toThrow(/not authorized/);

    const starterCust = uid("cust-starter");
    const starter = await purchaseAndActivate(starterCust, starterPlanId, adminUid);
    expect(starter.refreshesTotal).toBe(0);
    const starterJob = uid("job");
    await seedJob(starterJob, starterCust);
    await expect(
      recordMembershipRefresh.run({
        data: { membershipId: starter.id, jobId: starterJob },
        auth: studioAuth(staffUid),
      } as never),
    ).rejects.toThrow(/no interior refresh benefit/);
  });

  it("admin restore marks the row, returns the credit once, and allows a later consumption", async () => {
    const cust = uid("cust-restore");
    const membership = await purchaseAndActivate(cust, platinumPlanId, adminUid);
    const jobId = uid("job");
    await seedJob(jobId, cust);
    const recorded = (await recordMembershipRefresh.run({
      data: { membershipId: membership.id, jobId },
      auth: studioAuth(staffUid),
    } as never)) as { refreshUsageId: string };

    // Staff cannot restore; admin can.
    await expect(
      restoreMembershipRefresh.run({
        data: { membershipId: membership.id, refreshUsageId: recorded.refreshUsageId, reason: "recorded in error" },
        auth: studioAuth(staffUid),
      } as never),
    ).rejects.toThrow(/not authorized/);

    const restored = (await restoreMembershipRefresh.run({
      data: { membershipId: membership.id, refreshUsageId: recorded.refreshUsageId, reason: "visit cancelled before the refresh" },
      auth: adminAuth(adminUid),
    } as never)) as { alreadyRestored: boolean; refreshesUsed: number };
    expect(restored.alreadyRestored).toBe(false);
    expect(restored.refreshesUsed).toBe(0);

    const again = (await restoreMembershipRefresh.run({
      data: { membershipId: membership.id, refreshUsageId: recorded.refreshUsageId, reason: "duplicate restore" },
      auth: adminAuth(adminUid),
    } as never)) as { alreadyRestored: boolean };
    expect(again.alreadyRestored).toBe(true);

    const rows = await refreshRows(membership.id);
    expect(rows.length).toBe(1);
    expect(rows[0]?.restoredAt).toBeTruthy();
    const after = (await db.collection("memberships").doc(membership.id).get()).data() as Membership;
    expect(after.refreshesUsed).toBe(0);

    // The restored visit job can take a fresh record (the old row is restored).
    const fresh = (await recordMembershipRefresh.run({
      data: { membershipId: membership.id, jobId },
      auth: studioAuth(staffUid),
    } as never)) as { alreadyRecorded: boolean; refreshesUsed: number };
    expect(fresh.alreadyRecorded).toBe(false);
    expect(fresh.refreshesUsed).toBe(1);
    expect((await refreshRows(membership.id)).length).toBe(2);
  });

  it("expired membership cannot consume a refresh (lazy expiry parity with wash credits)", async () => {
    const cust = uid("cust-expired");
    const membership = await purchaseAndActivate(cust, platinumPlanId, adminUid);
    await db.collection("memberships").doc(membership.id).update({
      startDate: "2026-10-01",
      endDate: "2020-10-31",
    });
    const jobId = uid("job");
    await seedJob(jobId, cust);
    await expect(
      recordMembershipRefresh.run({
        data: { membershipId: membership.id, jobId },
        auth: studioAuth(staffUid),
      } as never),
    ).rejects.toThrow(/not active or has expired/);
  });
});
