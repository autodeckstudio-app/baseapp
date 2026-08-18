/**
 * Emulator integration tests for the additional-work approval workflow
 * (Phase 3). Run with: pnpm test:emulator (requires Firestore Emulator at
 * localhost:8080).
 *
 * Function-invocation tests use the real exported Cloud Function handlers
 * via `.run({ data, auth } as never)` — same pattern as
 * membership.emulator.test.ts / garage-ownership.emulator.test.ts.
 * Firestore-rules-only assertions (customer cannot create/alter an approval
 * directly, cross-customer/cross-tenant read denial) live in
 * security-rules.emulator.test.ts alongside every other collection.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking, ServiceJob, ApprovalRequest, Notification } from "@autodeck/core";

process.env["USE_PAYMENT_MOCK"] = "true";

import { createBooking } from "../../functions/booking/createBooking.js";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";
import { initiatePayment } from "../../functions/payment/initiatePayment.js";
import { createApproval } from "../../functions/approval/createApproval.js";
import { respondToApproval } from "../../functions/approval/respondToApproval.js";
import { cancelApproval } from "../../functions/approval/cancelApproval.js";
import { expireStaleApprovals } from "../../functions/approval/expireStaleApprovals.js";
import { onAuditLogCreated } from "../../functions/notification/onAuditLogCreated.js";

const db = getFirestore();

const TENANT_A = "approval-tenant-a";
const TENANT_B = "approval-tenant-b";
const STUDIO_ID = "approval-studio";

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null } };
}
function studioAuth(authUid: string, tenantId = TENANT_A, studioId = STUDIO_ID) {
  return { uid: authUid, token: { role: "studio", tenantId, studioId } };
}
function adminAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "admin", tenantId, studioId: null } };
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

let dayOffset = 2;
function nextDate(): string {
  dayOffset += 1;
  return new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10);
}

async function seedStudio(studioId: string, tenantId: string) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Approval Test Studio",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    operatingHours: [],
    holidays: [],
    vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
    slotIntervalMinutes: 30,
    maxAdvanceBookingDays: 30,
    cancellationWindowHours: 24,
    bays: Array.from({ length: 5 }, (_, i) => ({
      id: `${studioId}-general-${i + 1}`,
      tenantId,
      studioId,
      name: `General Bay ${i + 1}`,
      bayType: "general" as const,
      active: true,
    })),
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
}

async function seedService(serviceId: string, tenantId: string, basePrice = 100000) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Original Wash",
    category: "washing",
    brand: null,
    description: "Test service",
    basePrice,
    currency: "INR",
    estimatedDurationMinutes: 45,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    vehicleCategoryPricing: [],
    requiredBayType: "general",
    membershipWashEligible: false,
    active: true,
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("services").doc(serviceId).set(service);
  return service;
}

async function seedAdditionalService(serviceId: string, tenantId: string, name: string, basePrice: number) {
  const s = await seedService(serviceId, tenantId, basePrice);
  await db.collection("services").doc(serviceId).update({ name, category: "other" });
  return { ...s, name, category: "other" as const };
}

async function seedVehicle(vehicleId: string, tenantId: string, ownerId: string) {
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: vehicleId,
    tenantId,
    ownerId,
    registrationNumber: "GJ01AP" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
    make: "Honda",
    model: "City",
    year: 2022,
    color: "Grey",
    category: "sedan",
    photoUrl: null,
    odometer: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.collection("vehicles").doc(vehicleId).set(vehicle);
  return vehicle;
}

async function bookOnce(cust: string, vehicleId: string, service: Service, tenantId = TENANT_A, studioId = STUDIO_ID) {
  const result = (await createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId,
      vehicleCategory: "sedan",
      studioId,
      scheduledDate: nextDate(),
      scheduledTime: "10:00",
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(cust, tenantId),
  } as never)) as { booking: Booking };
  return result.booking;
}

async function jobForBooking(bookingId: string) {
  const snap = await db.collection("jobs").where("bookingId", "==", bookingId).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) throw new Error(`No job found for booking ${bookingId}`);
  return doc;
}

async function advanceOnce(jobId: string, studioUid: string, tenantId = TENANT_A) {
  await advanceJobStatus.run({ data: { jobId }, auth: studioAuth(studioUid, tenantId) } as never);
}

async function findAuditLog(action: string, entityId: string) {
  const snap = await db
    .collection("auditLog")
    .where("action", "==", action)
    .where("entityId", "==", entityId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) throw new Error(`No audit log found for ${action}/${entityId}`);
  return doc;
}

async function fireNotificationTrigger(action: string, entityId: string): Promise<Notification | null> {
  const logDoc = await findAuditLog(action, entityId);
  await onAuditLogCreated.run({ data: logDoc, params: { logId: logDoc.id } } as never);
  const notifSnap = await db.collection("notifications").doc(logDoc.id).get();
  return notifSnap.exists ? (notifSnap.data() as Notification) : null;
}

describe("Approval / additional-work workflow", () => {
  let originalService: Service;
  let adminUid: string;
  let studioUid: string;

  beforeAll(async () => {
    await seedStudio(STUDIO_ID, TENANT_A);
    originalService = await seedService(uid("svc"), TENANT_A);
    adminUid = uid("admin");
    studioUid = uid("studio");
  });

  async function setupInProgressJob(custPrefix: string) {
    const cust = uid(custPrefix);
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, originalService);
    const jobDoc = await jobForBooking(booking.id);
    await advanceOnce(jobDoc.id, studioUid); // -> VEHICLE_RECEIVED
    await advanceOnce(jobDoc.id, studioUid); // -> IN_PROGRESS
    return { cust, vehicle, booking, jobId: jobDoc.id };
  }

  describe("create", () => {
    it("1. studio creates an approval with a server-computed price snapshot", async () => {
      const { jobId } = await setupInProgressJob("cust-create");
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Interior Restoration", 150000);

      const result = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "Found stained interior" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      const snap = await db.collection("approvals").doc(result.approvalId).get();
      const approval = snap.data() as ApprovalRequest;
      expect(approval.status).toBe("pending");
      expect(approval.serviceName).toBe("Interior Restoration");
      expect(approval.priceImpact).toBeGreaterThan(0);
      expect(approval.newTotal).toBe(approval.originalAmount + approval.priceImpact);
    });

    it("rejects creation on a DELIVERED job", async () => {
      const cust = uid("cust-terminal");
      const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
      const booking = await bookOnce(cust, vehicle.id, originalService);
      const jobDoc = await jobForBooking(booking.id);
      for (let i = 0; i < 5; i++) await advanceOnce(jobDoc.id, studioUid);

      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 50000);
      await expect(
        createApproval.run({
          data: { jobId: jobDoc.id, serviceId: addSvc.id, reason: "too late" },
          auth: studioAuth(studioUid),
        } as never),
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });

    it("rejects creation once a payment is already in flight for the job (financial integrity boundary)", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-inflight");
      await initiatePayment.run({ data: { jobId, method: "cash" }, auth: customerAuth(cust) } as never);

      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 50000);
      await expect(
        createApproval.run({
          data: { jobId, serviceId: addSvc.id, reason: "too late" },
          auth: studioAuth(studioUid),
        } as never),
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });

    it("studio from a different studio cannot create an approval", async () => {
      const { jobId } = await setupInProgressJob("cust-wrongstudio");
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 50000);
      await expect(
        createApproval.run({
          data: { jobId, serviceId: addSvc.id, reason: "x" },
          auth: studioAuth(uid("other-studio-user"), TENANT_A, "some-other-studio"),
        } as never),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });

    it("cross-tenant: cannot select a service belonging to another tenant", async () => {
      const { jobId } = await setupInProgressJob("cust-crosstenantsvc");
      const svcB = await seedAdditionalService(uid("svc-b"), TENANT_B, "Other tenant service", 50000);
      await expect(
        createApproval.run({
          data: { jobId, serviceId: svcB.id, reason: "x" },
          auth: studioAuth(studioUid),
        } as never),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });
  });

  describe("approve / reject", () => {
    it("2. customer approves — job.totalAmount and additionalWorkDelta increase by exactly priceImpact", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-approve");
      const jobBefore = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra Coat", 80000);

      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      await respondToApproval.run({
        data: { approvalId: created.approvalId, decision: "approved" },
        auth: customerAuth(cust),
      } as never);

      const approval = (await db.collection("approvals").doc(created.approvalId).get()).data() as ApprovalRequest;
      const jobAfter = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;

      expect(approval.status).toBe("approved");
      expect(jobAfter.additionalWorkDelta).toBe(jobBefore.additionalWorkDelta + approval.priceImpact);
      expect(jobAfter.totalAmount).toBe(jobBefore.totalAmount + approval.priceImpact);
    });

    it("3. customer rejects — job total is unaffected, original work continues", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-reject");
      const jobBefore = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 40000);

      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      await respondToApproval.run({
        data: { approvalId: created.approvalId, decision: "rejected" },
        auth: customerAuth(cust),
      } as never);

      const approval = (await db.collection("approvals").doc(created.approvalId).get()).data() as ApprovalRequest;
      const jobAfter = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;

      expect(approval.status).toBe("rejected");
      expect(jobAfter.totalAmount).toBe(jobBefore.totalAmount);
      expect(jobAfter.additionalWorkDelta).toBe(jobBefore.additionalWorkDelta);
      // Job can still advance normally after a rejection.
      await advanceOnce(jobId, studioUid); // -> QUALITY_CHECK
      const jobStillProgressing = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      expect(jobStillProgressing.status).toBe("QUALITY_CHECK");
    });

    it("cross-customer: another customer cannot respond to this approval", async () => {
      const { jobId } = await setupInProgressJob("cust-owner");
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 40000);
      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      await expect(
        respondToApproval.run({
          data: { approvalId: created.approvalId, decision: "approved" },
          auth: customerAuth(uid("other-cust")),
        } as never),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });

    it("cross-tenant: a tenant-B customer cannot respond to a tenant-A approval", async () => {
      const { jobId } = await setupInProgressJob("cust-tenantcheck");
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 40000);
      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      await expect(
        respondToApproval.run({
          data: { approvalId: created.approvalId, decision: "approved" },
          auth: customerAuth(uid("cust-b"), TENANT_B),
        } as never),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });

    it("terminal approval cannot be mutated again (approve then approve again fails)", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-terminalmutate");
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 40000);
      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      await respondToApproval.run({
        data: { approvalId: created.approvalId, decision: "approved" },
        auth: customerAuth(cust),
      } as never);

      await expect(
        respondToApproval.run({
          data: { approvalId: created.approvalId, decision: "approved" },
          auth: customerAuth(cust),
        } as never),
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });

    it("duplicate approve request is rejected without double-incrementing the job total", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-dupapprove");
      const jobBefore = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 60000);
      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      await respondToApproval.run({
        data: { approvalId: created.approvalId, decision: "approved" },
        auth: customerAuth(cust),
      } as never);
      await expect(
        respondToApproval.run({
          data: { approvalId: created.approvalId, decision: "rejected" },
          auth: customerAuth(cust),
        } as never),
      ).rejects.toMatchObject({ code: "failed-precondition" });

      const jobAfter = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      const approval = (await db.collection("approvals").doc(created.approvalId).get()).data() as ApprovalRequest;
      expect(approval.status).toBe("approved"); // unchanged by the rejected retry
      expect(jobAfter.totalAmount).toBe(jobBefore.totalAmount + approval.priceImpact); // exactly once
    });

    it("approve + reject concurrently: exactly one decision wins, job total incremented at most once", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-race");
      const jobBefore = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 70000);
      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      const results = await Promise.allSettled([
        respondToApproval.run({
          data: { approvalId: created.approvalId, decision: "approved" },
          auth: customerAuth(cust),
        } as never),
        respondToApproval.run({
          data: { approvalId: created.approvalId, decision: "rejected" },
          auth: customerAuth(cust),
        } as never),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      expect(fulfilled).toBe(1); // exactly one of the two calls succeeded

      const approval = (await db.collection("approvals").doc(created.approvalId).get()).data() as ApprovalRequest;
      expect(["approved", "rejected"]).toContain(approval.status);

      const jobAfter = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      const expectedDelta = approval.status === "approved" ? approval.priceImpact : 0;
      expect(jobAfter.totalAmount).toBe(jobBefore.totalAmount + expectedDelta);
    });
  });

  describe("cancel / expire", () => {
    it("4. studio cancels a pending approval", async () => {
      const { jobId } = await setupInProgressJob("cust-cancel");
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 30000);
      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      await cancelApproval.run({ data: { approvalId: created.approvalId }, auth: studioAuth(studioUid) } as never);

      const approval = (await db.collection("approvals").doc(created.approvalId).get()).data() as ApprovalRequest;
      expect(approval.status).toBe("cancelled");
    });

    it("cancelling a non-pending approval is rejected", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-cancelterminal");
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 30000);
      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };
      await respondToApproval.run({
        data: { approvalId: created.approvalId, decision: "rejected" },
        auth: customerAuth(cust),
      } as never);

      await expect(
        cancelApproval.run({ data: { approvalId: created.approvalId }, auth: studioAuth(studioUid) } as never),
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });

    it("expireStaleApprovals sweep flips a past-expiry pending approval", async () => {
      const { jobId } = await setupInProgressJob("cust-expiresweep");
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 30000);
      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      await db.collection("approvals").doc(created.approvalId).update({
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
      });

      const result = (await expireStaleApprovals.run({ data: {}, auth: adminAuth(adminUid) } as never)) as {
        expiredCount: number;
      };
      expect(result.expiredCount).toBeGreaterThanOrEqual(1);

      const approval = (await db.collection("approvals").doc(created.approvalId).get()).data() as ApprovalRequest;
      expect(approval.status).toBe("expired");
    });

    it("responding to an already-expired approval is lazily flipped and rejected", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-lazyexpire");
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 30000);
      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      await db.collection("approvals").doc(created.approvalId).update({
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
      });

      await expect(
        respondToApproval.run({
          data: { approvalId: created.approvalId, decision: "approved" },
          auth: customerAuth(cust),
        } as never),
      ).rejects.toMatchObject({ code: "failed-precondition" });

      const approval = (await db.collection("approvals").doc(created.approvalId).get()).data() as ApprovalRequest;
      expect(approval.status).toBe("expired");
    });
  });

  describe("job integration", () => {
    it("5. job cannot be delivered while an approval is still pending", async () => {
      const { jobId } = await setupInProgressJob("cust-blockdeliver");
      await advanceOnce(jobId, studioUid); // -> QUALITY_CHECK
      await advanceOnce(jobId, studioUid); // -> READY_FOR_DELIVERY

      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 30000);
      await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never);

      await expect(advanceOnce(jobId, studioUid)).rejects.toMatchObject({ code: "failed-precondition" });

      const job = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      expect(job.status).toBe("READY_FOR_DELIVERY");
    });

    it("job delivers normally once the pending approval is resolved", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-resolvethendeliver");
      await advanceOnce(jobId, studioUid); // -> QUALITY_CHECK
      await advanceOnce(jobId, studioUid); // -> READY_FOR_DELIVERY

      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 30000);
      const created = (await createApproval.run({
        data: { jobId, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };
      await respondToApproval.run({
        data: { approvalId: created.approvalId, decision: "approved" },
        auth: customerAuth(cust),
      } as never);

      await advanceOnce(jobId, studioUid); // -> DELIVERED, should now succeed
      const job = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      expect(job.status).toBe("DELIVERED");
    });

    it("booking cancelled while an early-stage approval is pending: job becomes CANCELLED and the approval can no longer be approved by the customer, but studio can still cancel it", async () => {
      const cust = uid("cust-bookingcancel");
      const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
      const booking = await bookOnce(cust, vehicle.id, originalService);
      const jobDoc = await jobForBooking(booking.id);
      // Still PENDING_VEHICLE — approval can be requested even this early.
      const addSvc = await seedAdditionalService(uid("svc-add"), TENANT_A, "Extra", 30000);
      const created = (await createApproval.run({
        data: { jobId: jobDoc.id, serviceId: addSvc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      await cancelBooking.run({
        data: { bookingId: booking.id, reason: "customer changed mind" },
        auth: customerAuth(cust),
      } as never);

      const job = (await db.collection("jobs").doc(jobDoc.id).get()).data() as ServiceJob;
      expect(job.status).toBe("CANCELLED");

      await expect(
        respondToApproval.run({
          data: { approvalId: created.approvalId, decision: "approved" },
          auth: customerAuth(cust),
        } as never),
      ).rejects.toMatchObject({ code: "failed-precondition" });

      // Studio can still clean up the orphaned pending approval.
      await cancelApproval.run({ data: { approvalId: created.approvalId }, auth: studioAuth(studioUid) } as never);
      const approval = (await db.collection("approvals").doc(created.approvalId).get()).data() as ApprovalRequest;
      expect(approval.status).toBe("cancelled");
    });

    it("6. multiple approvals on the same job each remain independently auditable and accumulate", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-multi");
      const jobBefore = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      const svc1 = await seedAdditionalService(uid("svc-1"), TENANT_A, "Extra One", 30000);
      const svc2 = await seedAdditionalService(uid("svc-2"), TENANT_A, "Extra Two", 45000);

      const a1 = (await createApproval.run({
        data: { jobId, serviceId: svc1.id, reason: "first finding" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };
      await respondToApproval.run({
        data: { approvalId: a1.approvalId, decision: "approved" },
        auth: customerAuth(cust),
      } as never);

      const a2 = (await createApproval.run({
        data: { jobId, serviceId: svc2.id, reason: "second finding" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };
      await respondToApproval.run({
        data: { approvalId: a2.approvalId, decision: "approved" },
        auth: customerAuth(cust),
      } as never);

      const approval1 = (await db.collection("approvals").doc(a1.approvalId).get()).data() as ApprovalRequest;
      const approval2 = (await db.collection("approvals").doc(a2.approvalId).get()).data() as ApprovalRequest;
      const jobAfter = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;

      expect(approval1.status).toBe("approved");
      expect(approval2.status).toBe("approved");
      // Second approval's originalAmount reflects the first one already being applied.
      expect(approval2.originalAmount).toBe(jobBefore.totalAmount + approval1.priceImpact);
      expect(jobAfter.totalAmount).toBe(jobBefore.totalAmount + approval1.priceImpact + approval2.priceImpact);
    });
  });

  describe("audit trail", () => {
    it("create/approve/reject/cancel each produce a distinct AuditLog entry", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-audit");
      const svc = await seedAdditionalService(uid("svc-audit"), TENANT_A, "Audited Work", 20000);

      const created = (await createApproval.run({
        data: { jobId, serviceId: svc.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };
      await findAuditLog("approval.created", created.approvalId); // throws if missing

      await respondToApproval.run({
        data: { approvalId: created.approvalId, decision: "approved" },
        auth: customerAuth(cust),
      } as never);
      await findAuditLog("approval.approved", created.approvalId);

      const svc2 = await seedAdditionalService(uid("svc-audit2"), TENANT_A, "Audited Work 2", 20000);
      const created2 = (await createApproval.run({
        data: { jobId, serviceId: svc2.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };
      await respondToApproval.run({
        data: { approvalId: created2.approvalId, decision: "rejected" },
        auth: customerAuth(cust),
      } as never);
      await findAuditLog("approval.rejected", created2.approvalId);

      const svc3 = await seedAdditionalService(uid("svc-audit3"), TENANT_A, "Audited Work 3", 20000);
      const created3 = (await createApproval.run({
        data: { jobId, serviceId: svc3.id, reason: "x" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };
      await cancelApproval.run({ data: { approvalId: created3.approvalId }, auth: studioAuth(studioUid) } as never);
      await findAuditLog("approval.cancelled", created3.approvalId);
    });
  });

  describe("full integration flow", () => {
    it("7. studio creates -> customer notified -> customer approves -> studio sees live update -> audit trail complete", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-e2e");
      const svc = await seedAdditionalService(uid("svc-e2e"), TENANT_A, "End To End Work", 55000);

      // 1. Studio creates approval
      const created = (await createApproval.run({
        data: { jobId, serviceId: svc.id, reason: "Found corrosion" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      // 2. Customer receives a notification
      const requestedNotification = await fireNotificationTrigger("approval.created", created.approvalId);
      expect(requestedNotification?.userId).toBe(cust);
      expect(requestedNotification?.type).toBe("approval_requested");
      expect(requestedNotification?.entityType).toBe("Approval");
      expect(requestedNotification?.entityId).toBe(created.approvalId);

      // 3. Customer approves
      await respondToApproval.run({
        data: { approvalId: created.approvalId, decision: "approved" },
        auth: customerAuth(cust),
      } as never);

      // 4. Studio sees the live update (real-time listener backing collection)
      const approvalAfter = (await db.collection("approvals").doc(created.approvalId).get()).data() as ApprovalRequest;
      expect(approvalAfter.status).toBe("approved");

      // 5. Authorized additional amount appears correctly on the job
      const job = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      expect(job.additionalWorkDelta).toBe(approvalAfter.priceImpact);
      expect(job.totalAmount).toBe(approvalAfter.originalAmount + approvalAfter.priceImpact);

      // Customer also gets a confirmation notification
      const approvedNotification = await fireNotificationTrigger("approval.approved", created.approvalId);
      expect(approvedNotification?.userId).toBe(cust);
      expect(approvedNotification?.type).toBe("approval_approved");

      // 6. Audit records exist for both steps
      await findAuditLog("approval.created", created.approvalId);
      await findAuditLog("approval.approved", created.approvalId);
    });

    it("full rejection flow: studio creates -> customer notified -> customer declines -> studio sees rejection, original work unaffected", async () => {
      const { jobId, cust } = await setupInProgressJob("cust-e2ereject");
      const jobBefore = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      const svc = await seedAdditionalService(uid("svc-e2er"), TENANT_A, "Declined Work", 55000);

      const created = (await createApproval.run({
        data: { jobId, serviceId: svc.id, reason: "Found a scratch" },
        auth: studioAuth(studioUid),
      } as never)) as { approvalId: string };

      const requestedNotification = await fireNotificationTrigger("approval.created", created.approvalId);
      expect(requestedNotification).not.toBeNull();

      await respondToApproval.run({
        data: { approvalId: created.approvalId, decision: "rejected" },
        auth: customerAuth(cust),
      } as never);

      const approvalAfter = (await db.collection("approvals").doc(created.approvalId).get()).data() as ApprovalRequest;
      expect(approvalAfter.status).toBe("rejected");

      const job = (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;
      expect(job.totalAmount).toBe(jobBefore.totalAmount);

      const rejectedNotification = await fireNotificationTrigger("approval.rejected", created.approvalId);
      expect(rejectedNotification?.type).toBe("approval_rejected");
    });
  });
});
