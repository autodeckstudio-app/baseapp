/**
 * Emulator integration tests for multi-day service scheduling (Phase 5 Part 2).
 *
 * A PPF/ceramic-scale service can take multiple working days to complete.
 * These tests prove the end-to-end engine — computeScheduleEnd (pure lib),
 * the widened bay-occupancy range queries, and the per-day capacity gate in
 * generateDaySlots — behaves correctly through the real Cloud Functions
 * (createBooking, rescheduleBooking, createWalkinJob, getAvailability,
 * cancelBooking, updateService), not just at the pure-function level (see
 * src/test/unit/availability.test.ts for those).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type {
  StudioConfig,
  Service,
  Vehicle,
  Booking,
  ServiceJob,
  Customer,
} from "@autodeck/core";

import { createBooking } from "../helpers/paid-advance-booking.js";
import { rescheduleBooking } from "../../functions/booking/rescheduleBooking.js";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";
import { getAvailability } from "../../functions/booking/getAvailability.js";
import { createWalkinJob } from "../../functions/job/createWalkinJob.js";
import { setBookingQuote } from "../../functions/booking/setBookingQuote.js";
import { respondToBookingQuote } from "../../functions/booking/respondToBookingQuote.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";

const db = getFirestore();

const TENANT_A = "quote-tenant-a";
const TENANT_B = "quote-tenant-b";
const STUDIO_A = "quote-studio-a";

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return {
    uid: authUid,
    token: { role: "customer", tenantId, studioId: null },
  };
}
function studioAuth(authUid: string, tenantId = TENANT_A, studioId = STUDIO_A) {
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

// Deterministic future date landing on a specific UTC-noon-anchored weekday
// (0=Sun..6=Sat) — matches how functions/src/lib/schedule.ts derives
// day-of-week, so tests are independent of the machine's local timezone.
function dateWithDow(targetDow: number, minDaysOut: number): string {
  let d = new Date(Date.now() + minDaysOut * 86400000);
  let dateStr = d.toISOString().slice(0, 10);
  while (new Date(`${dateStr}T12:00:00Z`).getUTCDay() !== targetDow) {
    d = new Date(d.getTime() + 86400000);
    dateStr = d.toISOString().slice(0, 10);
  }
  return dateStr;
}
function nextMonday(minDaysOut = 5): string {
  return dateWithDow(1, minDaysOut);
}
function nextSaturday(minDaysOut = 5): string {
  return dateWithDow(6, minDaysOut);
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Mon-Sat 09:00-19:00 (600 min/day), Sunday closed — same shape as the real
// seeded studio (seed.ts) and the pure computeScheduleEnd unit tests.
const WEEKLY_HOURS = [
  { dayOfWeek: 0 as const, open: "09:00", close: "19:00", closed: true },
  { dayOfWeek: 1 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 2 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 3 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 4 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 5 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 6 as const, open: "09:00", close: "19:00", closed: false },
];

async function seedStudio(
  studioId: string,
  tenantId: string,
  bayCount: number,
  holidays: string[] = [],
) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Multi-day Test Studio",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    operatingHours: WEEKLY_HOURS,
    holidays,
    vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
    slotIntervalMinutes: 30,
    maxAdvanceBookingDays: 30,
    cancellationWindowHours: 24,
    bays: Array.from({ length: bayCount }, (_, i) => ({
      id: `${studioId}-bay-${i + 1}`,
      tenantId,
      studioId,
      name: `Protection Bay ${i + 1}`,
      bayType: "protection" as const,
      active: true,
    })),
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
  return studioConfig;
}

async function seedService(
  serviceId: string,
  tenantId: string,
  estimatedDurationMinutes: number,
) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Multi-day PPF Test",
    category: "ppf",
    brand: "TestBrand",
    description: "Test multi-day service",
    basePrice: 0,
    priceOnRequest: true,
    currency: "INR",
    estimatedDurationMinutes,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    vehicleCategoryPricing: [],
    requiredBayType: "protection",
    membershipWashEligible: false,
    active: true,
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("services").doc(serviceId).set(service);
  return service;
}

async function seedCustomer(customerId: string, tenantId: string) {
  const now = new Date().toISOString();
  const customer: Customer = {
    id: customerId,
    tenantId,
    authUid: customerId,
    name: "Multi-day Test Customer",
    phone: "+919876543210",
    notificationPrefs: { push: false, quietMode: false },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.collection("customers").doc(customerId).set(customer);
  return customer;
}

async function seedVehicle(
  vehicleId: string,
  ownerId: string,
  tenantId: string,
) {
  await db
    .collection("customers")
    .doc(ownerId)
    .set(
      { id: ownerId, authUid: ownerId, tenantId: tenantId, deletedAt: null },
      { merge: true },
    );
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: vehicleId,
    tenantId,
    ownerId,
    registrationNumber:
      "GJ01MD" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
    make: "Toyota",
    model: "Fortuner",
    year: 2023,
    color: "Black",
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

async function makeBooking(
  customerUid: string,
  service: Service,
  vehicle: Vehicle,
  studioId: string,
  scheduledDate: string,
  // 12:00 is not a held (priority) start time, so a normal customer can book it.
  scheduledTime = "12:00",
  tenantId = TENANT_A,
) {
  return createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId: vehicle.id,
      vehicleCategory: "suv",
      studioId,
      scheduledDate,
      scheduledTime,
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(customerUid, tenantId),
  } as never) as Promise<{ booking: Booking }>;
}

describe("Price-on-request quote flow", () => {
  it("quote requested -> blocked -> admin quotes -> customer approves -> job advances", async () => {
    const studio = await seedStudio(uid("studio-q"), TENANT_A, 2);
    const service = await seedService(uid("svc-q"), TENANT_A, 300);
    const customerId = uid("cust-q");
    await seedCustomer(customerId, TENANT_A);
    const vehicle = await seedVehicle(uid("veh"), customerId, TENANT_A);
    const { booking } = await makeBooking(
      customerId,
      service,
      vehicle,
      studio.id,
      nextMonday(),
    );
    const bk = async () =>
      (await db.collection("bookings").doc(booking.id).get()).data() as Record<
        string,
        unknown
      >;
    const b0 = await bk();
    console.log("QUOTE1 created", b0.quoteStatus, b0.priceOnRequest);
    expect(b0.quoteStatus).toBe("requested");
    const job = (
      await db
        .collection("jobs")
        .where("bookingId", "==", booking.id)
        .limit(1)
        .get()
    ).docs[0];
    const studioA = studioAuth(uid("staff"), TENANT_A, studio.id);
    await expect(
      advanceJobStatus.run({
        data: { jobId: job?.id },
        auth: studioA,
      } as never),
    ).rejects.toThrow(/approve the quote/);
    console.log("QUOTE2 advance blocked before quote OK");
    await expect(
      respondToBookingQuote.run({
        data: {
          bookingId: booking.id,
          expectedTotalPaise: (await bk()).totalAmount,
          expectedUpdatedAt: (await bk()).updatedAt,
        },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow();
    console.log("QUOTE3 approve before quote rejected OK");
    await expect(
      setBookingQuote.run({
        data: { bookingId: booking.id, basePricePaise: 700000 },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow();
    await setBookingQuote.run({
      data: { bookingId: booking.id, basePricePaise: 700000 },
      auth: adminAuth(uid("adm")),
    } as never);
    const {createApproval:requestExtra}=await import("../../functions/approval/createApproval.js");
    await expect(requestExtra.run({data:{jobId:job!.id,serviceId:service.id,reason:"Extra before quote approval"},auth:studioA} as never)).rejects.toThrow(/original booking quote/);
    const {buildApproval}=await import("../../lib/approval-builder.js");
    const oldExtra=await seedService(uid("old-extra"),TENANT_A,30);await db.collection("services").doc(oldExtra.id).update({priceOnRequest:false,basePrice:5000});
    const oldJob=(await job!.ref.get()).data() as ServiceJob;
    const oldApproval=buildApproval({id:uid("existing-pending"),job:oldJob,service:{...oldExtra,basePrice:5000},quantity:1,reason:"Existing pending extra before stage gate",requestedBy:studioA.uid,createdAt:new Date().toISOString()});
    await db.collection("approvals").doc(oldApproval.id).set(oldApproval);
    const {respondToApproval:answerExisting}=await import("../../functions/approval/respondToApproval.js");
    await expect(answerExisting.run({data:{approvalId:oldApproval.id,decision:"approved"},auth:customerAuth(customerId)} as never)).rejects.toMatchObject({code:"failed-precondition"});
    expect((await db.collection("approvals").doc(oldApproval.id).get()).data()!["status"]).toBe("pending");
    const q = await bk();
    console.log(
      "QUOTE4 after admin quote",
      q.quoteStatus,
      JSON.stringify(q.priceBreakdown ?? q.totalPrice ?? q.basePrice),
    );
    expect(q.quoteStatus).toBe("quoted");
    await expect(
      advanceJobStatus.run({
        data: { jobId: job?.id },
        auth: studioA,
      } as never),
    ).rejects.toThrow(/approve the quote/);
    const displayed = {
      bookingId: booking.id,
      expectedTotalPaise: q.totalAmount,
      expectedUpdatedAt: q.updatedAt,
    };
    await expect(
      respondToBookingQuote.run({
        data: { ...displayed, expectedTotalPaise: Number(q.totalAmount) - 1 },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow(/changed/);
    await expect(
      respondToBookingQuote.run({
        data: { ...displayed, expectedUpdatedAt: "stale" },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow(/changed/);
    const stranger = uid("stranger");
    await seedCustomer(stranger, TENANT_A);
    await expect(
      respondToBookingQuote.run({
        data: displayed,
        auth: customerAuth(stranger),
      } as never),
    ).rejects.toThrow(/Not your booking/);
    await respondToBookingQuote.run({
      data: displayed,
      auth: customerAuth(customerId),
    } as never);
    expect((await bk()).quoteStatus).toBe("approved");
    await respondToBookingQuote.run({
      data: {
        bookingId: booking.id,
        expectedTotalPaise: q.totalAmount,
        expectedUpdatedAt: q.updatedAt,
      },
      auth: customerAuth(customerId),
    } as never);
    expect(
      (await db.collection("consultQuoteApprovals").get()).size,
    ).toBeGreaterThan(0);
    console.log("QUOTE5 approved");
    const r = await advanceJobStatus.run({
      data: { jobId: job?.id },
      auth: studioA,
    } as never);
    console.log("QUOTE6 advanced", JSON.stringify(r).slice(0, 120));
    const { readConsultPaymentBinding } =
      await import("../../lib/consult-payment.js");
    const liveJob = (await job!.ref.get()).data() as ServiceJob;
    await expect(
      readConsultPaymentBinding(db, undefined, liveJob, await bk()),
    ).resolves.toMatchObject({ amountPaise: q.totalAmount });
    await answerExisting.run({data:{approvalId:oldApproval.id,decision:"approved"},auth:customerAuth(customerId)} as never);
    await expect(answerExisting.run({data:{approvalId:oldApproval.id,decision:"approved"},auth:customerAuth(customerId)} as never)).rejects.toMatchObject({code:"failed-precondition"});
    expect((await db.collection("consultApprovedDeltas").doc(oldApproval.id).get()).exists).toBe(true);
    const { createApproval } =
      await import("../../functions/approval/createApproval.js");
    const { respondToApproval } =
      await import("../../functions/approval/respondToApproval.js");
    const extra = await seedService(uid("extra"), TENANT_A, 30);
    await db
      .collection("services")
      .doc(extra.id)
      .update({ priceOnRequest: false, basePrice: 10000 });
    const additional = await createApproval.run({
      data: {
        jobId: job!.id,
        serviceId: extra.id,
        reason: "Customer requested extra",
      },
      auth: studioA,
    } as never);
    await expect(
      respondToApproval.run({
        data: { approvalId: additional.approvalId, decision: "approved" },
        auth: customerAuth(stranger),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await respondToApproval.run({
      data: { approvalId: additional.approvalId, decision: "approved" },
      auth: customerAuth(customerId),
    } as never);
    await expect(
      respondToApproval.run({
        data: { approvalId: additional.approvalId, decision: "approved" },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    const blocked = await createApproval.run({
      data: {
        jobId: job!.id,
        serviceId: extra.id,
        reason: "Second work request",
      },
      auth: studioA,
    } as never);
    const inFlight = db.collection("payments").doc(uid("inflight"));
    await inFlight.set({ jobId: job!.id, status: "pending" });
    await expect(
      respondToApproval.run({
        data: { approvalId: blocked.approvalId, decision: "approved" },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(
      (
        await db
          .collection("consultApprovedDeltas")
          .doc(blocked.approvalId)
          .get()
      ).exists,
    ).toBe(false);
    await inFlight.delete();

    await respondToBookingQuote.run({data:displayed,auth:customerAuth(customerId)} as never);
    const afterExtra = (await job!.ref.get()).data() as ServiceJob;
    await expect(
      readConsultPaymentBinding(db, undefined, afterExtra, await bk()),
    ).resolves.toMatchObject({ amountPaise: afterExtra.totalAmount });
    expect(
      (
        await db
          .collection("consultApprovedDeltas")
          .doc(additional.approvalId)
          .get()
      ).exists,
    ).toBe(true);
    const beforeFree=await readConsultPaymentBinding(db,undefined,afterExtra,await bk());
    const free=await seedService(uid("free-extra"),TENANT_A,30);await db.collection("services").doc(free.id).update({priceOnRequest:false,basePrice:0});
    const freeRequest=await createApproval.run({data:{jobId:job!.id,serviceId:free.id,reason:"Free additional work"},auth:studioA} as never);
    await expect(respondToApproval.run({data:{approvalId:freeRequest.approvalId,decision:"approved"},auth:customerAuth(stranger)} as never)).rejects.toMatchObject({code:"permission-denied"});
    await inFlight.set({jobId:job!.id,status:"pending"});
    await expect(respondToApproval.run({data:{approvalId:freeRequest.approvalId,decision:"approved"},auth:customerAuth(customerId)} as never)).rejects.toMatchObject({code:"failed-precondition"});await inFlight.delete();
    await respondToApproval.run({data:{approvalId:freeRequest.approvalId,decision:"approved"},auth:customerAuth(customerId)} as never);
    await expect(respondToApproval.run({data:{approvalId:freeRequest.approvalId,decision:"approved"},auth:customerAuth(customerId)} as never)).rejects.toMatchObject({code:"failed-precondition"});
    const afterFree=(await job!.ref.get()).data() as ServiceJob;expect(afterFree.totalAmount).toBe(afterExtra.totalAmount);expect(afterFree.additionalWorkDelta).toBe(afterExtra.additionalWorkDelta);
    expect((await db.collection("approvals").doc(freeRequest.approvalId).get()).data()!["status"]).toBe("approved");expect((await db.collection("consultApprovedDeltas").doc(freeRequest.approvalId).get()).exists).toBe(false);
    expect(await readConsultPaymentBinding(db,undefined,afterFree,await bk())).toEqual(beforeFree);
    await job!.ref.update({ "priceBreakdown.pickupFee": 100 });
    await expect(
      readConsultPaymentBinding(
        db,
        undefined,
        (await job!.ref.get()).data() as ServiceJob,
        await bk(),
      ),
    ).rejects.toThrow(/Fresh customer approval/);
    await job!.ref.update({
      "priceBreakdown.pickupFee": liveJob.priceBreakdown.pickupFee,
    });
    await job!.ref.update({ totalAmount: liveJob.totalAmount + 1 });
    await expect(
      readConsultPaymentBinding(
        db,
        undefined,
        (await job!.ref.get()).data() as ServiceJob,
        await bk(),
      ),
    ).rejects.toThrow(/Fresh customer approval/);
  });
});

it("new enquiry offer and customer acceptance create one immutable booking receipt", async () => {
  const { requestServiceQuote, updateServiceQuote } =
    await import("../../functions/booking/serviceQuoteJourney.js");
  const { readConsultPaymentBinding } =
    await import("../../lib/consult-payment.js");
  const studio = await seedStudio(uid("new-studio"), TENANT_A, 2),
    service = await seedService("menu-coat-kovalent-graphene", TENANT_A, 60),
    customer = uid("new-customer");
  await seedCustomer(customer, TENANT_A);
  const car = await seedVehicle(uid("new-car"), customer, TENANT_A),
    qid = uid("enquiry");
  const own = customerAuth(customer),
    admin = adminAuth(uid("admin"));
  await requestServiceQuote.run({
    data: {
      requestId: qid,
      studioId: studio.id,
      scope: {
        serviceId: service.id,
        productKey: null,
        vehicleId: car.id,
        coverage: "Full body",
      },
    },
    auth: own,
  } as never);
  const offer = {
    revision: 1,
    totalPaise: 118000,
    workingMinutes: 60,
    included: "Full body exact work",
    excluded: "Damage",
    termsVersion: "terms1",
  };
  await updateServiceQuote.run({
    data: {
      id: qid,
      expectedVersion: 1,
      operationId: "offer",
      command: { kind: "offer", offer },
    },
    auth: admin,
  } as never);
  await updateServiceQuote.run({
    data: {
      id: qid,
      expectedVersion: 2,
      operationId: "accept",
      command: { kind: "answer", decision: "accept", offerRevision: 1 },
    },
    auth: own,
  } as never);
  const req = {
    data: {
      serviceId: service.id,
      vehicleId: car.id,
      vehicleCategory: "suv",
      studioId: studio.id,
      scheduledDate: nextMonday(),
      scheduledTime: "11:00",
      idempotencyKey: uid("book"),
      quoteJourneyId: qid,
      quoteRevision: 1,
      quoteTermsVersion: "terms1",
    },
    auth: own,
  };
  await expect(
    createBooking.run({
      ...req,
      data: { ...req.data, quoteTermsVersion: "stale" },
    } as never),
  ).rejects.toMatchObject({ code: "failed-precondition" });
  const stranger = uid("new-other");
  await seedCustomer(stranger, TENANT_A);
  await expect(
    createBooking.run({ ...req, auth: customerAuth(stranger) } as never),
  ).rejects.toMatchObject({ code: "permission-denied" });
  const result = await createBooking.run(req as never);
  const booking = result.booking as Booking;
  const jobs = await db
      .collection("jobs")
      .where("bookingId", "==", booking.id)
      .get(),
    job = jobs.docs[0]!.data() as ServiceJob;
  const stored = (
    await db.collection("bookings").doc(booking.id).get()
  ).data()!;
  await expect(
    readConsultPaymentBinding(db, undefined, job, stored),
  ).resolves.toMatchObject({ amountPaise: 118000 });
  expect((await createBooking.run(req as never)).booking.id).toBe(booking.id);
  const rows = await db
    .collection("consultQuoteApprovals")
    .where("quote.bookingId", "==", booking.id)
    .get();
  expect(rows.size).toBe(1);
});
