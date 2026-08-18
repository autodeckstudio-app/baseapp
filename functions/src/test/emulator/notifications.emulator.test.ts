/**
 * Emulator integration tests for the customer notification system (Phase 2C).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 *
 * These invoke the REAL exported Cloud Function handlers in-process via the
 * `.run({ data, auth } as never)` entry point — same pattern as
 * membership.emulator.test.ts / walkin-financial.emulator.test.ts. The
 * `onAuditLogCreated` Firestore trigger is invoked the same way — its
 * CloudFunction wrapper exposes `.run(event)` just like a callable — after
 * fetching the real AuditLog document the triggering function actually
 * wrote, so the trigger's own read/write logic runs unmodified.
 *
 * Firestore-rules-level assertions (customer cannot create/alter a
 * notification directly, cross-customer/cross-tenant read denial) live in
 * security-rules.emulator.test.ts alongside every other collection's rules
 * tests, not here.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking, Notification } from "@autodeck/core";

process.env["USE_PAYMENT_MOCK"] = "true";

import { createBooking } from "../../functions/booking/createBooking.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";
import { initiatePayment } from "../../functions/payment/initiatePayment.js";
import { confirmPaymentMock } from "../../functions/payment/confirmPaymentMock.js";
import { createMembershipPlan } from "../../functions/membership/createMembershipPlan.js";
import { purchaseMembership } from "../../functions/membership/purchaseMembership.js";
import { activateMembership } from "../../functions/membership/activateMembership.js";
import { expireStaleMemberships } from "../../functions/membership/expireStaleMemberships.js";
import { markNotificationRead } from "../../functions/notification/markNotificationRead.js";
import { onAuditLogCreated } from "../../functions/notification/onAuditLogCreated.js";

const db = getFirestore();

const TENANT_A = "notif-tenant-a";
const TENANT_B = "notif-tenant-b";
const STUDIO_ID = "notif-studio";

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null } };
}
function studioAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "studio", tenantId, studioId: STUDIO_ID } };
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
    name: "Notification Test Studio",
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
      id: `${studioId}-wash-${i + 1}`,
      tenantId,
      studioId,
      name: `Wash Bay ${i + 1}`,
      bayType: "wash" as const,
      active: true,
    })),
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
}

async function seedService(serviceId: string, tenantId: string) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Notification Test Wash",
    category: "washing",
    brand: null,
    description: "Test service",
    basePrice: 50000,
    currency: "INR",
    estimatedDurationMinutes: 30,
    warrantyLabel: null,
    vehicleCategoryPricing: [],
    requiredBayType: "wash",
    membershipWashEligible: true,
    active: true,
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("services").doc(serviceId).set(service);
  return service;
}

async function seedVehicle(vehicleId: string, tenantId: string, ownerId: string) {
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: vehicleId,
    tenantId,
    ownerId,
    registrationNumber: "GJ01NB" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
    make: "Toyota",
    model: "Fortuner",
    year: 2023,
    color: "White",
    category: "suv",
    photoUrl: null,
    odometer: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.collection("vehicles").doc(vehicleId).set(vehicle);
  return vehicle;
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

async function fireTrigger(logDoc: FirebaseFirestore.QueryDocumentSnapshot) {
  await onAuditLogCreated.run({ data: logDoc, params: { logId: logDoc.id } } as never);
}

async function fireFor(action: string, entityId: string): Promise<Notification | null> {
  const logDoc = await findAuditLog(action, entityId);
  await fireTrigger(logDoc);
  const notifSnap = await db.collection("notifications").doc(logDoc.id).get();
  return notifSnap.exists ? (notifSnap.data() as Notification) : null;
}

async function bookOnce(cust: string, vehicleId: string, service: Service) {
  const result = (await createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId,
      vehicleCategory: "suv",
      studioId: STUDIO_ID,
      scheduledDate: nextDate(),
      scheduledTime: "10:00",
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(cust),
  } as never)) as { booking: Booking };
  return result.booking;
}

async function jobForBooking(bookingId: string) {
  const snap = await db.collection("jobs").where("bookingId", "==", bookingId).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) throw new Error(`No job found for booking ${bookingId}`);
  return doc;
}

describe("Notification system", () => {
  let service: Service;
  let adminUid: string;
  let studioUid: string;

  beforeAll(async () => {
    await seedStudio(STUDIO_ID, TENANT_A);
    service = await seedService(uid("service"), TENANT_A);
    adminUid = uid("admin");
    studioUid = uid("studio");
  });

  it("1. AuditLog event creates a notification", async () => {
    const cust = uid("cust-basic");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, service);

    const notification = await fireFor("booking.created", booking.id);
    expect(notification).not.toBeNull();
  });

  it("2. notification has the correct recipient", async () => {
    const cust = uid("cust-recipient");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, service);

    const notification = await fireFor("booking.created", booking.id);
    expect(notification?.userId).toBe(cust);
  });

  it("3. notification has the correct tenant", async () => {
    const cust = uid("cust-tenant");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, service);

    const notification = await fireFor("booking.created", booking.id);
    expect(notification?.tenantId).toBe(TENANT_A);
  });

  it("4. notification has the correct type", async () => {
    const cust = uid("cust-type");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, service);

    const notification = await fireFor("booking.created", booking.id);
    expect(notification?.type).toBe("booking_confirmed");
  });

  it("5. notification has the correct entity reference", async () => {
    const cust = uid("cust-entity");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, service);

    const notification = await fireFor("booking.created", booking.id);
    expect(notification?.entityType).toBe("Booking");
    expect(notification?.entityId).toBe(booking.id);
  });

  it("6. duplicate trigger delivery is idempotent — same auditLogId never creates a second notification", async () => {
    const cust = uid("cust-dup");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, service);

    const logDoc = await findAuditLog("booking.created", booking.id);
    await fireTrigger(logDoc);
    await fireTrigger(logDoc); // redelivery — must not throw and must not duplicate

    const all = await db.collection("notifications").where("auditLogId", "==", logDoc.id).get();
    expect(all.docs.length).toBe(1);
  });

  it("11. mark-read sets readAt and is idempotent on repeat calls", async () => {
    const cust = uid("cust-read");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, service);
    const notification = await fireFor("booking.created", booking.id);
    if (!notification) throw new Error("Expected a notification to have been created");
    const notificationId = notification.id;

    await markNotificationRead.run({
      data: { notificationId },
      auth: customerAuth(cust),
    } as never);
    const after = (await db.collection("notifications").doc(notificationId).get()).data() as Notification;
    expect(after.readAt).not.toBeNull();

    // Calling again must not throw and must not change the timestamp destructively
    await markNotificationRead.run({
      data: { notificationId },
      auth: customerAuth(cust),
    } as never);
    const afterAgain = (await db.collection("notifications").doc(notificationId).get()).data() as Notification;
    expect(afterAgain.readAt).toBe(after.readAt);
  });

  it("12. an unrelated audit action creates no notification", async () => {
    const logRef = db.collection("auditLog").doc();
    await logRef.set({
      id: logRef.id,
      tenantId: TENANT_A,
      studioId: null,
      action: "vehicle.created",
      entityType: "Vehicle",
      entityId: "irrelevant-vehicle",
      performedBy: "system",
      performedByRole: "system",
      before: null,
      after: null,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    const logDoc = (await logRef.get()) as FirebaseFirestore.QueryDocumentSnapshot;
    await fireTrigger(logDoc);

    const notifSnap = await db.collection("notifications").doc(logRef.id).get();
    expect(notifSnap.exists).toBe(false);
  });

  describe("13. booking events", () => {
    it("booking cancelled produces a booking_cancelled notification", async () => {
      const cust = uid("cust-cancel");
      const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
      const booking = await bookOnce(cust, vehicle.id, service);

      const { cancelBooking } = await import("../../functions/booking/cancelBooking.js");
      await cancelBooking.run({
        data: { bookingId: booking.id, reason: "changed my mind" },
        auth: customerAuth(cust),
      } as never);

      const notification = await fireFor("booking.cancelled", booking.id);
      expect(notification?.type).toBe("booking_cancelled");
      expect(notification?.userId).toBe(cust);
    });

    it("booking rescheduled produces a booking_rescheduled notification", async () => {
      const cust = uid("cust-resched");
      const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
      const booking = await bookOnce(cust, vehicle.id, service);

      const { rescheduleBooking } = await import("../../functions/booking/rescheduleBooking.js");
      await rescheduleBooking.run({
        data: { bookingId: booking.id, newDate: nextDate(), newTime: "11:00", idempotencyKey: uid("idem") },
        auth: customerAuth(cust),
      } as never);

      const notification = await fireFor("booking.rescheduled", booking.id);
      expect(notification?.type).toBe("booking_rescheduled");
      expect(notification?.entityType).toBe("Booking");
      expect(notification?.entityId).toBe(booking.id);
    });
  });

  describe("14. job events", () => {
    it("job status advancing to IN_PROGRESS produces job_started; intermediate/no-op statuses produce nothing", async () => {
      const cust = uid("cust-job");
      const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
      const booking = await bookOnce(cust, vehicle.id, service);
      const jobDoc = await jobForBooking(booking.id);
      expect(jobDoc).toBeTruthy();

      // PENDING_VEHICLE -> VEHICLE_RECEIVED: no notification
      await advanceJobStatus.run({ data: { jobId: jobDoc.id }, auth: studioAuth(studioUid) } as never);
      const afterReceived = await fireFor("job.status_advanced", jobDoc.id);
      expect(afterReceived).toBeNull();

      // VEHICLE_RECEIVED -> IN_PROGRESS: job_started
      await advanceJobStatus.run({ data: { jobId: jobDoc.id }, auth: studioAuth(studioUid) } as never);
      const started = await fireFor("job.status_advanced", jobDoc.id);
      expect(started?.type).toBe("job_started");
      expect(started?.userId).toBe(cust);
      expect(started?.entityType).toBe("Booking");
      expect(started?.entityId).toBe(booking.id);
    });

    it("job status advancing to READY_FOR_DELIVERY produces job_completed", async () => {
      const cust = uid("cust-job2");
      const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
      const booking = await bookOnce(cust, vehicle.id, service);
      const jobDoc = await jobForBooking(booking.id);

      await advanceJobStatus.run({ data: { jobId: jobDoc.id }, auth: studioAuth(studioUid) } as never); // VEHICLE_RECEIVED
      await advanceJobStatus.run({ data: { jobId: jobDoc.id }, auth: studioAuth(studioUid) } as never); // IN_PROGRESS
      await advanceJobStatus.run({ data: { jobId: jobDoc.id }, auth: studioAuth(studioUid) } as never); // QUALITY_CHECK
      const afterQC = await fireFor("job.status_advanced", jobDoc.id);
      expect(afterQC).toBeNull();

      await advanceJobStatus.run({ data: { jobId: jobDoc.id }, auth: studioAuth(studioUid) } as never); // READY_FOR_DELIVERY
      const completed = await fireFor("job.status_advanced", jobDoc.id);
      expect(completed?.type).toBe("job_completed");
    });
  });

  describe("15. payment events", () => {
    it("payment success produces payment_successful, resolved to the owning Booking", async () => {
      const cust = uid("cust-pay-ok");
      const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
      const booking = await bookOnce(cust, vehicle.id, service);
      const jobDoc = await jobForBooking(booking.id);

      const initiated = (await initiatePayment.run({
        data: { jobId: jobDoc.id, method: "cash" },
        auth: customerAuth(cust),
      } as never)) as { paymentId: string };

      await confirmPaymentMock.run({
        data: { paymentId: initiated.paymentId, mockResult: "success" },
        auth: studioAuth(studioUid),
      } as never);

      const notification = await fireFor("payment.completed", initiated.paymentId);
      expect(notification?.type).toBe("payment_successful");
      expect(notification?.userId).toBe(cust);
      expect(notification?.entityType).toBe("Booking");
      expect(notification?.entityId).toBe(booking.id);
    });

    it("payment failure produces payment_failed", async () => {
      const cust = uid("cust-pay-fail");
      const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
      const booking = await bookOnce(cust, vehicle.id, service);
      const jobDoc = await jobForBooking(booking.id);

      const initiated = (await initiatePayment.run({
        data: { jobId: jobDoc.id, method: "cash" },
        auth: customerAuth(cust),
      } as never)) as { paymentId: string };

      await confirmPaymentMock.run({
        data: { paymentId: initiated.paymentId, mockResult: "failure" },
        auth: studioAuth(studioUid),
      } as never);

      const notification = await fireFor("payment.failed", initiated.paymentId);
      expect(notification?.type).toBe("payment_failed");
      expect(notification?.userId).toBe(cust);
    });
  });

  it("16. invoice issuance produces an invoice_issued notification", async () => {
    const cust = uid("cust-invoice");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, service);
    const jobDoc = await jobForBooking(booking.id);

    const initiated = (await initiatePayment.run({
      data: { jobId: jobDoc.id, method: "cash" },
      auth: customerAuth(cust),
    } as never)) as { paymentId: string };

    const confirmed = (await confirmPaymentMock.run({
      data: { paymentId: initiated.paymentId, mockResult: "success" },
      auth: studioAuth(studioUid),
    } as never)) as { paymentId: string };
    void confirmed;

    const paymentAfter = (await db.collection("payments").doc(initiated.paymentId).get()).data() as {
      invoiceId: string;
    };

    const notification = await fireFor("invoice.issued", paymentAfter.invoiceId);
    expect(notification?.type).toBe("invoice_issued");
    expect(notification?.userId).toBe(cust);
    expect(notification?.entityType).toBe("Invoice");
    expect(notification?.entityId).toBe(paymentAfter.invoiceId);
  });

  describe("17. membership events", () => {
    it("membership activation produces a membership_activated notification", async () => {
      const cust = uid("cust-mem-active");
      const planResult = (await createMembershipPlan.run({
        data: { tier: "gold", name: "Gold", priceInPaise: 299900, includedWashes: 4, discountPercent: 15 },
        auth: adminAuth(adminUid),
      } as never)) as { plan: { id: string } };

      const purchase = (await purchaseMembership.run({
        data: { planId: planResult.plan.id, method: "cash", idempotencyKey: uid("idem") },
        auth: customerAuth(cust),
      } as never)) as { membershipId: string; paymentId: string };

      await confirmPaymentMock.run({
        data: { paymentId: purchase.paymentId, mockResult: "success" },
        auth: adminAuth(adminUid),
      } as never);

      await activateMembership.run({
        data: { membershipId: purchase.membershipId },
        auth: adminAuth(adminUid),
      } as never);

      const notification = await fireFor("membership.activated", purchase.membershipId);
      expect(notification?.type).toBe("membership_activated");
      expect(notification?.userId).toBe(cust);
      expect(notification?.entityType).toBe("Membership");
      expect(notification?.entityId).toBe(purchase.membershipId);
    });

    it("membership expiry sweep produces a membership_expired notification", async () => {
      const cust = uid("cust-mem-expired");
      const membershipRef = db.collection("memberships").doc();
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      await membershipRef.set({
        id: membershipRef.id,
        tenantId: TENANT_A,
        customerId: cust,
        planId: "plan-x",
        tier: "silver",
        status: "active",
        washesTotal: 2,
        washesUsed: 0,
        discountPercent: 10,
        startDate: "2020-01-01",
        endDate: yesterday,
        activatedAt: "2020-01-01T00:00:00.000Z",
        activatedBy: adminUid,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
      });

      await expireStaleMemberships.run({ data: {}, auth: adminAuth(adminUid) } as never);

      const notification = await fireFor("membership.expired", membershipRef.id);
      expect(notification?.type).toBe("membership_expired");
      expect(notification?.userId).toBe(cust);
    });
  });

  it("cross-tenant isolation: a tenant-B event never resolves a tenant-A recipient", async () => {
    await seedStudio("notif-studio-b", TENANT_B);
    const serviceB = await seedService(uid("service-b"), TENANT_B);
    const custB = uid("cust-b");
    const vehicleB = await seedVehicle(uid("veh-b"), TENANT_B, custB);

    const result = (await createBooking.run({
      data: {
        serviceId: serviceB.id,
        vehicleId: vehicleB.id,
        vehicleCategory: "suv",
        studioId: "notif-studio-b",
        scheduledDate: nextDate(),
        scheduledTime: "10:00",
        idempotencyKey: uid("idem"),
      },
      auth: customerAuth(custB, TENANT_B),
    } as never)) as { booking: Booking };

    const notification = await fireFor("booking.created", result.booking.id);
    expect(notification?.tenantId).toBe(TENANT_B);
    expect(notification?.userId).toBe(custB);
  });
});
