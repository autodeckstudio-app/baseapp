/**
 * CUSTODY CROSS-APP EXECUTION PROBE (2026-11-17) — mixed-service visit driven
 * through the REAL handlers: createBooking (400+200/100 extras) -> role
 * scoping -> staff progress -> per-line QC readiness guard -> admin-only seal
 * -> delivery guard -> billing totals. Isolated emulator only.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import type { Booking, ServiceJob } from "@autodeck/core";

import { createBooking } from "../helpers/paid-advance-booking.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";
import { recordJobPerformedWork } from "../../functions/work/recordJobPerformedWork.js";
import { getMyVisit, getStaffVisit } from "../../functions/visit/getVisit.js";
import { recordManualPayment } from "../../functions/payment/recordManualPayment.js";
import { confirmManualPayment } from "../../functions/payment/confirmManualPayment.js";

const db = getFirestore();
const TENANT = "custody-crossapp-tenant";
const STUDIO = "custody-crossapp-studio";

const auth = {
  customer: (uid: string) => ({ uid, token: { role: "customer", tenantId: TENANT, studioId: null } }),
  studio: (uid: string, studioId = STUDIO) => ({ uid, token: { role: "studio", tenantId: TENANT, studioId } }),
  admin: (uid: string) => ({ uid, token: { role: "admin", tenantId: TENANT, studioId: null } }),
};

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;

const WEEKLY_HOURS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dayOfWeek: d as 0 | 1 | 2 | 3 | 4 | 5 | 6, open: "09:00", close: "19:00", closed: d === 0,
}));

function futureDow(dow: number, minDaysOut = 5): string {
  let d = new Date(Date.now() + minDaysOut * 86400000);
  let s = d.toISOString().slice(0, 10);
  while (new Date(`${s}T12:00:00Z`).getUTCDay() !== dow) { d = new Date(d.getTime() + 86400000); s = d.toISOString().slice(0, 10); }
  return s;
}

async function seedService(minutes: number, name: string) {
  const id = uid("svc"); const now = new Date().toISOString();
  await db.collection("services").doc(id).set({
    id, tenantId: TENANT, name, category: "ppf", brand: "TestBrand", description: "probe",
    basePrice: 100000_00, currency: "INR", estimatedDurationMinutes: minutes,
    warrantyLabel: null, warrantyDurationValue: null, warrantyDurationUnit: null,
    vehicleCategoryPricing: [], requiredBayType: "protection", membershipWashEligible: false,
    active: true, displayOrder: 0, createdAt: now, updatedAt: now,
  });
  return id;
}

async function seedWorld() {
  await db.collection("studioConfig").doc(STUDIO).set({
    id: STUDIO, tenantId: TENANT, studioId: STUDIO, name: "CrossApp Probe Studio",
    timezone: "Asia/Kolkata", currency: "INR", taxRatePercent: 18, taxDescription: "GST 18%",
    operatingHours: WEEKLY_HOURS, holidays: [],
    vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
    slotIntervalMinutes: 30, maxAdvanceBookingDays: 30, cancellationWindowHours: 24,
    bays: [{ id: `${STUDIO}-bay-1`, tenantId: TENANT, studioId: STUDIO, name: "P1", bayType: "protection", active: true }],
    updatedAt: new Date().toISOString(),
  });
  const customerId = uid("cust"); const now = new Date().toISOString();
  await db.collection("customers").doc(customerId).set({
    id: customerId, authUid: customerId, tenantId: TENANT, name: "Probe", phone: "+919876543210",
    notificationPrefs: { push: false, quietMode: false }, createdAt: now, updatedAt: now, deletedAt: null,
  });
  const vehicleId = uid("veh");
  await db.collection("vehicles").doc(vehicleId).set({
    id: vehicleId, tenantId: TENANT, ownerId: customerId, registrationNumber: "GJ01MD1234",
    make: "Toyota", model: "Fortuner", year: 2023, color: "Black", category: "suv",
    photoUrl: null, odometer: null, createdAt: now, updatedAt: now, deletedAt: null,
  });
  await db.collection("memberships").doc(`prio-${customerId}`).set({
    id: `prio-${customerId}`, tenantId: TENANT, customerId, status: "active", prioritySlot: true, endDate: null,
  });
  return { customerId, vehicleId };
}

const freshJob = async (jobId: string) => (await db.collection("jobs").doc(jobId).get()).data() as ServiceJob;

async function advance(jobId: string, as: ReturnType<typeof auth.studio> | ReturnType<typeof auth.admin>) {
  const j = await freshJob(jobId);
  return advanceJobStatus.run({
    data: { jobId, expectedStatus: j.status, expectedUpdatedAt: j.updatedAt, operationId: uid("op") },
    auth: as,
  } as never);
}

async function record(jobId: string, lineId: string, expectedRevision: number, as: ReturnType<typeof auth.studio>) {
  const r = (await recordJobPerformedWork.run({
    data: { jobId, operationId: randomUUID(), expectedRevision, action: "record", lineId, approvalId: null, performed: true, work: { kind: "service" } },
    auth: as,
  } as never)) as { committedRevision: number };
  return r.committedRevision;
}
async function qc(jobId: string, lineId: string, expectedRevision: number, as: ReturnType<typeof auth.studio>) {
  const r = (await recordJobPerformedWork.run({
    data: { jobId, operationId: randomUUID(), expectedRevision, action: "qc", lineId, checked: true },
    auth: as,
  } as never)) as { committedRevision: number };
  return r.committedRevision;
}

describe("cross-app mixed-service execution chain", () => {
  it("progress/QC/delivery/scoping/billing across the real handlers", async () => {
    const { customerId, vehicleId } = await seedWorld();
    const primary = await seedService(400, "Primary PPF");
    const extra1 = await seedService(200, "Extra Coating");
    const extra2 = await seedService(100, "Extra Detail");

    const { booking } = (await createBooking.run({
      data: {
        serviceId: primary, vehicleId, vehicleCategory: "suv", studioId: STUDIO,
        scheduledDate: futureDow(2), scheduledTime: "09:00", idempotencyKey: uid("idem"),
        extraServiceIds: [extra1, extra2],
      },
      auth: auth.customer(customerId),
    } as never)) as { booking: Booking };

    // BILLING: exact mixed-service totals on both booking and job snapshots.
    // GST is env-gated (GST_ENABLED off in this emulator run -> tax 0 "No
    // tax"), so assert identity: subtotal is the 3-line sum and total is
    // subtotal + tax at the recorded rate - not a hardcoded tax figure.
    expect(booking.priceBreakdown.subtotal).toBe(300000_00);
    expect(booking.priceBreakdown.tax).toBe(Math.round(300000_00 * booking.priceBreakdown.taxRatePercent) / 100);
    expect(booking.totalAmount).toBe(booking.priceBreakdown.subtotal + booking.priceBreakdown.tax);
    const jobId = (await db.collection("jobs").where("bookingId", "==", booking.id).limit(1).get()).docs[0]!.id;
    const job0 = await freshJob(jobId);
    expect(job0.totalAmount).toBe(booking.totalAmount);
    expect(job0.lines!.map((l) => l.durationMinutes)).toEqual([400, 200, 100]);

    // ROLE SCOPING through the real read handlers.
    const own = (await getMyVisit.run({ data: { jobId }, auth: auth.customer(customerId) } as never)) as { status: string };
    expect(own.status).toBe("ungrouped");
    const stranger = uid("cust");
    await db.collection("customers").doc(stranger).set({
      id: stranger, authUid: stranger, tenantId: TENANT, name: "Other", phone: "+919876543211",
      notificationPrefs: { push: false, quietMode: false }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null,
    });
    await expect(getMyVisit.run({ data: { jobId }, auth: auth.customer(stranger) } as never)).rejects.toThrow();
    await expect(getStaffVisit.run({ data: { jobId }, auth: auth.studio(uid("staff"), "another-studio") } as never)).rejects.toThrow();
    await expect(
      recordJobPerformedWork.run({
        data: { jobId, operationId: randomUUID(), expectedRevision: 0, action: "record", lineId: "booked-0", approvalId: null, performed: true, work: { kind: "service" } },
        auth: auth.customer(customerId),
      } as never),
    ).rejects.toThrow();

    // PROGRESS: PENDING_VEHICLE -> VEHICLE_RECEIVED -> IN_PROGRESS -> QUALITY_CHECK.
    const staff = auth.studio(uid("staff"));
    const admin = auth.admin(uid("admin"));
    await advance(jobId, staff);
    expect((await freshJob(jobId)).status).toBe("VEHICLE_RECEIVED");
    await advance(jobId, staff);
    expect((await freshJob(jobId)).status).toBe("IN_PROGRESS");
    await advance(jobId, staff);
    expect((await freshJob(jobId)).status).toBe("QUALITY_CHECK");

    // GUARD 1: READY_FOR_DELIVERY with NO recorded work on a multi-service visit.
    await expect(advance(jobId, staff)).rejects.toThrow(/Check every service/);

    // Record + QC only line 1 of 3.
    let rev = await record(jobId, "booked-0", 0, staff);
    rev = await qc(jobId, "booked-0", rev, staff);

    // GUARD 2: one complete line must NOT make the visit ready.
    await expect(advance(jobId, staff)).rejects.toThrow(/Check every service/);

    // Complete the remaining lines.
    rev = await record(jobId, "booked-1", rev, staff);
    rev = await qc(jobId, "booked-1", rev, staff);
    rev = await record(jobId, "booked-2", rev, staff);
    rev = await qc(jobId, "booked-2", rev, staff);

    // GUARD 3: seal is admin-only.
    await expect(
      recordJobPerformedWork.run({ data: { jobId, operationId: randomUUID(), expectedRevision: rev, action: "seal", confirmed: true }, auth: staff } as never),
    ).rejects.toThrow();

    const sealed = (await recordJobPerformedWork.run({
      data: { jobId, operationId: randomUUID(), expectedRevision: rev, action: "seal", confirmed: true }, auth: admin,
    } as never)) as { committedRevision: number };
    expect(sealed.committedRevision).toBe(rev + 1);

    // Now READY_FOR_DELIVERY passes; DELIVERED requires the recorded work revision.
    await advance(jobId, staff);
    expect((await freshJob(jobId)).status).toBe("READY_FOR_DELIVERY");

    // GUARD 4: DELIVERED without the recorded-work revision is refused.
    await expect(advance(jobId, staff)).rejects.toThrow();

    // GUARD 5: even with the sealed revision, DELIVERED refuses an UNPAID visit.
    const jUnpaid = await freshJob(jobId);
    await expect(
      advanceJobStatus.run({
        data: { jobId, expectedStatus: jUnpaid.status, expectedUpdatedAt: jUnpaid.updatedAt, operationId: uid("op"), recordedWorkRevision: sealed.committedRevision },
        auth: staff,
      } as never),
    ).rejects.toThrow(/payment/i);

    // Settle through the real manual-payment handlers (staff records, admin confirms).
    const recorded = (await recordManualPayment.run({
      data: { jobId, method: "cash", manualReference: "probe-cash-1" }, auth: staff,
    } as never)) as { paymentId: string };
    await confirmManualPayment.run({ data: { paymentId: recorded.paymentId }, auth: admin } as never);
    expect((await freshJob(jobId)).paymentStatus).toBe("paid");

    const jFinal = await freshJob(jobId);
    await advanceJobStatus.run({
      data: { jobId, expectedStatus: jFinal.status, expectedUpdatedAt: jFinal.updatedAt, operationId: uid("op"), recordedWorkRevision: sealed.committedRevision },
      auth: staff,
    } as never);
    const delivered = await freshJob(jobId);
    expect(delivered.status).toBe("DELIVERED");
    expect(delivered.sealedAt).toBeTruthy();
    expect(delivered.paymentStatus).toBe("paid");
  }, 30000);
});
