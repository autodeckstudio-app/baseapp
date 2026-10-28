/**
 * Emulator tests for the Studio staff-app backend batch (2026-10-26):
 *  1. updatePickupRequest refuses to CONFIRM an unpriced (feePaise null)
 *     request, so a no-pin request can never silently bill Rs 0.
 *  2. Inspection photos: issueInspectionPhotoUploadUrl guards +
 *     updateInspection { addPhotos } path validation.
 *  3. Staff-to-admin approval requests: requestAdminApproval /
 *     respondToAdminApproval roles, tenant scoping, idempotency, and the
 *     /adminApprovalRequests Firestore rules.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StudioConfig, Service, Vehicle, Booking, ServiceJob, AdminApprovalRequest } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

import { createBooking } from "../../functions/booking/createBooking.js";
import { requestPickupDrop, updatePickupRequest } from "../../functions/booking/pickupRequests.js";
import { startInspection } from "../../functions/inspection/startInspection.js";
import { updateInspection } from "../../functions/inspection/updateInspection.js";
import { finalizeInspection } from "../../functions/inspection/finalizeInspection.js";
import { requestAdminApproval } from "../../functions/approval/requestAdminApproval.js";
import { recordManualPayment } from "../../functions/payment/recordManualPayment.js";
import { respondToAdminApproval } from "../../functions/approval/respondToAdminApproval.js";

const db = getFirestore();

const TENANT_A = "sbb-tenant-a";
const TENANT_B = "sbb-tenant-b";
const STUDIO_A = "sbb-studio-a";

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}
let dayOffset = 3;
let dayWrap = 0;
// The booking window refuses >30 days out and the shared counter was already AT that boundary for the last consumer, so
// adding any test before it broke it. Wrap the day counter instead and move to a later time slot on each wrap (one bay, so a
// reused day at the same time would collide). Only fixture dates change; no assertion is touched.
const SLOT_BY_WRAP = ["10:00", "13:00", "16:00"];
function nextDate(): string {
  dayOffset += 1;
  if (dayOffset > 28) { dayOffset = 4; dayWrap += 1; }
  return new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10);
}

// Seeds a photo object the way a signed-URL PUT would land it: bytes plus the
// customerId custom metadata binding that storage.rules scopes reads by.
async function seedPhotoObjectWithKey(path: string, metadataKey: string, customerId: string, contentType = "image/jpeg") {
  await getStorage()
    .bucket()
    .file(path)
    .save(Buffer.from("fake-image-bytes"), { metadata: { contentType, metadata: { [metadataKey]: customerId } } });
}

async function seedPhotoObject(path: string, customerId: string, contentType = "image/jpeg") {
  await seedPhotoObjectWithKey(path, "customerId", customerId, contentType);
}

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null }, rawToken: "test" };
}
function studioAuth(authUid: string, studioId: string = STUDIO_A, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "studio", tenantId, studioId }, rawToken: "test" };
}
function adminAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "admin", tenantId, studioId: null }, rawToken: "test" };
}

async function seedStudio(studioId: string, tenantId: string) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Batch Test Studio",
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
    bays: [
      { id: `${studioId}-wash-1`, tenantId, studioId, name: "Wash Bay 1", bayType: "wash" as const, active: true },
    ],
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
}

async function seedService(serviceId: string, tenantId: string) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Batch Test Wash",
    category: "washing",
    brand: null,
    description: "Test service",
    basePrice: 50000,
    currency: "INR",
    estimatedDurationMinutes: 30,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
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
    registrationNumber: "GJ01BB" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
    make: "Maruti",
    model: "Swift",
    year: 2022,
    color: "White",
    category: "hatchback",
    photoUrl: null,
    odometer: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.collection("vehicles").doc(vehicleId).set(vehicle);
  return vehicle;
}

async function freshJob(
  service: Service,
  tenantId = TENANT_A,
  studioId: string = STUDIO_A,
  scheduledDate?: string,
  scheduledTime?: string,
): Promise<{ booking: Booking; job: ServiceJob; customerId: string }> {
  const customerId = uid("cust");
  const vehicle = await seedVehicle(uid("veh"), tenantId, customerId);
  const result = (await createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId: vehicle.id,
      vehicleCategory: "hatchback",
      studioId,
      // Callers may pin an explicit date so they do not consume the shared
      // nextDate() counter: the booking window refuses >30 days out, and the
      // cumulative counter sits exactly at that boundary for the last suite
      // consumer (recordManualPayment in-flight guard).
      scheduledDate: scheduledDate ?? nextDate(),
      scheduledTime: scheduledTime ?? SLOT_BY_WRAP[Math.min(dayWrap, SLOT_BY_WRAP.length - 1)]!,
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(customerId, tenantId),
  } as never)) as { booking: Booking };
  const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", result.booking.id).get();
  const job = jobsSnap.docs[0]?.data() as ServiceJob;
  return { booking: result.booking, job, customerId };
}

async function expectErr(p: Promise<unknown>, code: string, messagePart?: string) {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    expect(err.code ?? "").toContain(code);
    if (messagePart) expect(err.message ?? "").toContain(messagePart);
    return;
  }
  throw new Error(`expected ${code}, but the call succeeded`);
}

// ─── 1. Unpriced pickup guard ────────────────────────────────────────────────

describe("updatePickupRequest — unpriced (no-pin) requests cannot be confirmed free", () => {
  let service: Service;

  beforeAll(async () => {
    await seedStudio(STUDIO_A, TENANT_A);
    await seedStudio("sbb-studio-b-tenant", TENANT_B);
    service = await seedService(uid("svc"), TENANT_A);
  });

  it("blocks CONFIRMED while feePaise is null, then allows it once an admin prices the request", async () => {
    const { booking, customerId } = await freshJob(service);
    // No lat/lng -> server cannot compute a fee -> feePaise null.
    await requestPickupDrop.run({
      data: { bookingId: booking.id, kind: "both", address: "12, Test Society, Ahmedabad 380006" },
      auth: customerAuth(customerId),
    } as never);

    const staff = studioAuth(uid("staff"));
    await expectErr(
      updatePickupRequest.run({
        data: { requestId: booking.id, status: "CONFIRMED", agreedPickupAt: `${nextDate()} 10:30`, agreedDropAt: `${nextDate()} 18:00` },
        auth: staff,
      } as never),
      "failed-precondition",
      "no fee yet",
    );

    // The request is still REQUESTED - the blocked confirm changed nothing.
    let snap = await db.collection(COLLECTIONS.pickupRequests()).doc(booking.id).get();
    expect(snap.data()?.status).toBe("REQUESTED");

    // Admin prices it (allowed only while REQUESTED), then staff confirm.
    await updatePickupRequest.run({
      data: { requestId: booking.id, status: "REQUESTED", feePaise: 20000 },
      auth: adminAuth(uid("admin")),
    } as never);
    const confirmed = (await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", agreedPickupAt: `${nextDate()} 10:30`, agreedDropAt: `${nextDate()} 18:00` },
      auth: staff,
    } as never)) as { status: string; feeBilled: boolean };
    expect(confirmed.status).toBe("CONFIRMED");

    snap = await db.collection(COLLECTIONS.pickupRequests()).doc(booking.id).get();
    expect(snap.data()?.feePaise).toBe(20000);
  });

  it("an admin-set fee of 0 (deliberate free) still confirms", async () => {
    const { booking, customerId } = await freshJob(service);
    await requestPickupDrop.run({
      data: { bookingId: booking.id, kind: "pickup", address: "12, Test Society, Ahmedabad 380006" },
      auth: customerAuth(customerId),
    } as never);
    await updatePickupRequest.run({
      data: { requestId: booking.id, status: "REQUESTED", feePaise: 0 },
      auth: adminAuth(uid("admin")),
    } as never);
    const confirmed = (await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", agreedPickupAt: `${nextDate()} 10:30` },
      auth: studioAuth(uid("staff")),
    } as never)) as { status: string };
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("a pin-priced request (fee computed at request time) confirms without admin involvement", async () => {
    const { booking, customerId } = await freshJob(service);
    await requestPickupDrop.run({
      data: {
        bookingId: booking.id,
        kind: "pickup",
        address: "12, Test Society, Ahmedabad 380006",
        lat: 23.03, // ~1.2 km from the studio door
        lng: 72.57,
      },
      auth: customerAuth(customerId),
    } as never);
    const snap = await db.collection(COLLECTIONS.pickupRequests()).doc(booking.id).get();
    expect(snap.data()?.feePaise).toBeGreaterThan(0);
    const confirmed = (await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", agreedPickupAt: `${nextDate()} 10:30` },
      auth: studioAuth(uid("staff")),
    } as never)) as { status: string };
    expect(confirmed.status).toBe("CONFIRMED");
  });
});

// ─── 2. Inspection photos ────────────────────────────────────────────────────

describe("inspection photos — addPhotos path validation", () => {
  let service: Service;

  beforeAll(async () => {
    // Isolation: take only a service that belongs to THIS file's tenant. A bare limit(1) picks up any other test file's
    // service on a shared emulator (different tenant), which fails every call below with "Cross-tenant access denied".
    await seedStudio(STUDIO_A, TENANT_A);
    service = (await db.collection("services").where("tenantId", "==", TENANT_A).limit(1).get()).docs[0]?.data() as Service;
    if (!service) service = await seedService(uid("svc"), TENANT_A);
  });

  it("appends only this job's own photo paths, deduped", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);

    const good = [`${job.tenantId}/jobs/${job.id}/photos/a.jpg`, `${job.tenantId}/jobs/${job.id}/photos/b.jpg`];
    for (const p of good) await seedPhotoObject(p, job.customerId);
    await updateInspection.run({ data: { jobId: job.id, addPhotos: good }, auth: staff } as never);
    // Re-adding the same path is a no-op (not even re-verified), and a new one appends.
    const cPath = `${job.tenantId}/jobs/${job.id}/photos/c.jpg`;
    await seedPhotoObject(cPath, job.customerId);
    await updateInspection.run(
      { data: { jobId: job.id, addPhotos: [good[0]!, cPath] }, auth: staff } as never,
    );

    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect(snap.data()?.photos).toEqual([...good, `${job.tenantId}/jobs/${job.id}/photos/c.jpg`]);
  });

  it("rejects paths outside the job's own photo prefix (other job / other tenant)", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);

    await expectErr(
      updateInspection.run(
        { data: { jobId: job.id, addPhotos: [`${job.tenantId}/jobs/some-other-job/photos/x.jpg`] }, auth: staff } as never,
      ),
      "invalid-argument",
    );
    await expectErr(
      updateInspection.run(
        { data: { jobId: job.id, addPhotos: [`other-tenant/jobs/${job.id}/photos/x.jpg`] }, auth: staff } as never,
      ),
      "invalid-argument",
    );

    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect(snap.data()?.photos).toEqual([]);
  });

  it("rejects photo edits once the inspection is finalized", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);
    await finalizeInspection.run({ data: { jobId: job.id }, auth: staff } as never);
    await expectErr(
      updateInspection.run(
        { data: { jobId: job.id, addPhotos: [`${job.tenantId}/jobs/${job.id}/photos/late.jpg`] }, auth: staff } as never,
      ),
      "failed-precondition",
    );
  });

  it("verifies the object at attach time: missing upload, wrong customer binding, wrong type all rejected", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);
    const base = `${job.tenantId}/jobs/${job.id}/photos`;

    // Well-formed path, but nothing was ever PUT there.
    await expectErr(
      updateInspection.run({ data: { jobId: job.id, addPhotos: [`${base}/never-uploaded.jpg`] }, auth: staff } as never),
      "not-found",
    );

    // Uploaded, but bound to a different customer (cross-job/customer pinning).
    const foreign = `${base}/foreign.jpg`;
    await seedPhotoObject(foreign, "some-other-customer");
    await expectErr(
      updateInspection.run({ data: { jobId: job.id, addPhotos: [foreign] }, auth: staff } as never),
      "failed-precondition",
    );

    // Uploaded with the right binding but a non-image content type.
    const wrongType = `${base}/wrong-type.jpg`;
    await seedPhotoObject(wrongType, job.customerId, "text/plain");
    await expectErr(
      updateInspection.run({ data: { jobId: job.id, addPhotos: [wrongType] }, auth: staff } as never),
      "failed-precondition",
    );

    // Nothing was attached by any of the rejected attempts.
    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect(snap.data()?.photos).toEqual([]);
  });

  it("accepts the lowercase customerid key that real signed-URL PUTs land, and still rejects a wrong-customer binding in that casing", async () => {
    // Pinned date+time: do not consume the shared nextDate() counter (see
    // freshJob); 17:30 avoids the bay/time slot every counter booking uses.
    const { job } = await freshJob(service, TENANT_A, STUDIO_A, "2026-11-10", "17:30");
    const staff = studioAuth(uid("staff"));
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);
    const base = `${job.tenantId}/jobs/${job.id}/photos`;

    // Production evidence (2026-10-26 live fixture on autodeck-studio): a v4
    // signed-URL PUT carrying the x-goog-meta-customerId header stores the
    // metadata key LOWERCASED ("customerid") - the XML API normalizes header
    // names. The attach-time binding check must accept that casing or every
    // real browser upload is refused with "not bound to this inspection's
    // customer".
    const lower = `${base}/lower.png`;
    await seedPhotoObjectWithKey(lower, "customerid", job.customerId, "image/png");
    await updateInspection.run({ data: { jobId: job.id, addPhotos: [lower] }, auth: staff } as never);

    // Same casing, wrong customer: the binding itself is unchanged and still bites.
    const foreignLower = `${base}/foreign-lower.png`;
    await seedPhotoObjectWithKey(foreignLower, "customerid", "some-other-customer", "image/png");
    await expectErr(
      updateInspection.run({ data: { jobId: job.id, addPhotos: [foreignLower] }, auth: staff } as never),
      "failed-precondition",
    );

    // camelCase (SDK / JSON-API writes) keeps working - no regression.
    const camel = `${base}/camel.png`;
    await seedPhotoObjectWithKey(camel, "customerId", job.customerId, "image/png");
    await updateInspection.run({ data: { jobId: job.id, addPhotos: [camel] }, auth: staff } as never);

    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect(snap.data()?.photos).toEqual([lower, camel]);
  });

  it("rejects instead of silently truncating when the 20-photo limit would be exceeded", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);
    // Seed 20 objects and attach them across two calls.
    const first: string[] = [];
    for (let i = 0; i < 20; i++) {
      const p = `${job.tenantId}/jobs/${job.id}/photos/p${String(i).padStart(2, "0")}.jpg`;
      await seedPhotoObject(p, job.customerId);
      first.push(p);
    }
    await updateInspection.run({ data: { jobId: job.id, addPhotos: first.slice(0, 15) }, auth: staff } as never);
    await updateInspection.run({ data: { jobId: job.id, addPhotos: first.slice(15) }, auth: staff } as never);
    // The 21st NEW photo is refused outright - the evidence set stays whole.
    const extra = `${job.tenantId}/jobs/${job.id}/photos/p20.jpg`;
    await seedPhotoObject(extra, job.customerId);
    await expectErr(
      updateInspection.run({ data: { jobId: job.id, addPhotos: [extra] }, auth: staff } as never),
      "failed-precondition",
      "at most 20",
    );
    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect(snap.data()?.photos).toHaveLength(20);
    expect(snap.data()?.photos).not.toContain(extra);
  });

  it("issueInspectionPhotoUploadUrl refuses before the inspection exists", async () => {
    const { job } = await freshJob(service);
    const { issueInspectionPhotoUploadUrl } = await import("../../functions/inspection/issueInspectionPhotoUploadUrl.js");
    await expectErr(
      issueInspectionPhotoUploadUrl.run({
        data: { jobId: job.id, contentType: "image/jpeg" },
        auth: studioAuth(uid("staff")),
      } as never),
      "failed-precondition",
      "Start the inspection",
    );
  });

  it("issueInspectionPhotoUploadUrl refuses customers and cross-studio staff", async () => {
    const { job, customerId } = await freshJob(service);
    const { issueInspectionPhotoUploadUrl } = await import("../../functions/inspection/issueInspectionPhotoUploadUrl.js");
    await expectErr(
      issueInspectionPhotoUploadUrl.run({
        data: { jobId: job.id, contentType: "image/jpeg" },
        auth: customerAuth(customerId),
      } as never),
      "permission-denied",
    );
    await expectErr(
      issueInspectionPhotoUploadUrl.run({
        data: { jobId: job.id, contentType: "image/jpeg" },
        auth: studioAuth(uid("staff"), "sbb-studio-other"),
      } as never),
      "permission-denied",
    );
  });
});

// ─── 3. Staff-to-admin approval requests ─────────────────────────────────────

describe("staff-to-admin approval requests", () => {
  let service: Service;

  beforeAll(async () => {
    // Isolation: take only a service that belongs to THIS file's tenant. A bare limit(1) picks up any other test file's
    // service on a shared emulator (different tenant), which fails every call below with "Cross-tenant access denied".
    await seedStudio(STUDIO_A, TENANT_A);
    service = (await db.collection("services").where("tenantId", "==", TENANT_A).limit(1).get()).docs[0]?.data() as Service;
    if (!service) service = await seedService(uid("svc"), TENANT_A);
  });

  it("studio files a request about a job; admin approves with a note; staff read the answer", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    const { requestId } = (await requestAdminApproval.run({
      data: {
        targetType: "job",
        targetId: job.id,
        reason: "Customer asked to leave the car overnight after a late handover - okay to keep the keys?",
      },
      auth: staff,
    } as never)) as { requestId: string };

    const decided = (await respondToAdminApproval.run({
      data: { requestId, decision: "approved", note: "Fine for tonight only. Log the odometer." },
      auth: adminAuth(uid("admin")),
    } as never)) as { status: string; idempotent: boolean };
    expect(decided.status).toBe("approved");
    expect(decided.idempotent).toBe(false);

    const snap = await db.collection(COLLECTIONS.adminApprovalRequests()).doc(requestId).get();
    const doc = snap.data() as AdminApprovalRequest;
    expect(doc.status).toBe("approved");
    expect(doc.responseNote).toContain("tonight");
    expect(doc.respondedBy).toBeTruthy();
    expect(doc.requestedBy).toBe(staff.uid);
  });

  it("an identical repeat response is an idempotent no-op; a conflicting one is refused", async () => {
    const staff = studioAuth(uid("staff"));
    const { requestId } = (await requestAdminApproval.run({
      data: { targetType: "none", reason: "Can I order replacement microfiber cloths this week?" },
      auth: staff,
    } as never)) as { requestId: string };

    const admin = adminAuth(uid("admin"));
    await respondToAdminApproval.run({ data: { requestId, decision: "rejected", note: "Next month." }, auth: admin } as never);
    const repeat = (await respondToAdminApproval.run({
      data: { requestId, decision: "rejected", note: "Next month." },
      auth: admin,
    } as never)) as { idempotent: boolean };
    expect(repeat.idempotent).toBe(true);
    await expectErr(
      respondToAdminApproval.run({ data: { requestId, decision: "approved" }, auth: admin } as never),
      "failed-precondition",
      "already rejected",
    );
  });

  it("customers cannot file or respond; studio staff cannot respond; cross-tenant is refused", async () => {
    const { job, customerId } = await freshJob(service);
    await expectErr(
      requestAdminApproval.run({
        data: { targetType: "job", targetId: job.id, reason: "Customer should never file this." },
        auth: customerAuth(customerId),
      } as never),
      "permission-denied",
    );

    const { requestId } = (await requestAdminApproval.run({
      data: { targetType: "job", targetId: job.id, reason: "Real staff request." },
      auth: studioAuth(uid("staff")),
    } as never)) as { requestId: string };

    await expectErr(
      respondToAdminApproval.run({ data: { requestId, decision: "approved" }, auth: studioAuth(uid("staff2")) } as never),
      "permission-denied",
    );
    await expectErr(
      respondToAdminApproval.run(
        { data: { requestId, decision: "approved" }, auth: adminAuth(uid("admin-b"), TENANT_B) } as never,
      ),
      "permission-denied",
    );
  });

  it("validates the target: unknown records and other tenants' jobs are refused", async () => {
    const staff = studioAuth(uid("staff"));
    await expectErr(
      requestAdminApproval.run(
        { data: { targetType: "job", targetId: "no-such-job", reason: "About a missing job." }, auth: staff } as never,
      ),
      "not-found",
    );
    await seedStudio("sbb-studio-b", TENANT_B);
    const serviceB = await seedService(uid("svc-b"), TENANT_B);
    const { job: otherTenantJob } = await freshJob(serviceB, TENANT_B, "sbb-studio-b");
    await expectErr(
      requestAdminApproval.run(
        { data: { targetType: "job", targetId: otherTenantJob.id, reason: "Not my tenant's job." }, auth: staff } as never,
      ),
      "permission-denied",
    );
    await expectErr(
      requestAdminApproval.run(
        { data: { targetType: "none", targetId: "something", reason: "Contradictory input." }, auth: staff } as never,
      ),
      "invalid-argument",
    );
  });
});



// ─── 4. Inspection photo signed-URL upload flow (Storage emulator) ───────────

describe("inspection photo upload - signed URL PUT, metadata binding, read scoping", () => {
  let storageEnv: RulesTestEnvironment;
  let service: Service;

  beforeAll(async () => {
    storageEnv = await initializeTestEnvironment({
      projectId: "autodeck-dev",
      storage: { rules: readFileSync(resolve(__dirname, "../../../../storage.rules"), "utf8"), host: "localhost", port: 9199 },
    });
    await seedStudio(STUDIO_A, TENANT_A);
    service = await seedService(uid("svc"), TENANT_A);
  });

  // Requires TEST_SIGN_CLIENT_EMAIL/TEST_SIGN_PRIVATE_KEY (see emulator-setup.ts):
  // minting a signed URL needs a service-account keypair, which CI does not have.
  it.skipIf(!process.env["TEST_SIGN_PRIVATE_KEY"])("PUT lands bytes with customerId metadata; staff+owner read, other customer denied; inspection records the path", async () => {
    const { job, customerId } = await freshJob(service);
    const staffUid = uid("staff");
    const staff = studioAuth(staffUid);
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);

    const { issueInspectionPhotoUploadUrl } = await import("../../functions/inspection/issueInspectionPhotoUploadUrl.js");
    const issued = (await issueInspectionPhotoUploadUrl.run({
      data: { jobId: job.id, contentType: "image/jpeg" },
      auth: staff,
    } as never)) as { uploadUrl: string; path: string; requiredHeaders: Record<string, string> };

    expect(issued.path).toContain(`${job.tenantId}/jobs/${job.id}/photos/`);
    expect(issued.requiredHeaders["x-goog-meta-customerId"]).toBe(customerId);
    // Overwrite/reuse threat: the issued URL is create-only. The
    // generation-match precondition means GCS answers 412 to any second PUT
    // at the same path inside (or after) the 10-minute window, so an
    // already-attached, already-verified photo cannot be swapped for
    // different bytes, a different type, or an oversize object after the
    // fact. Enforcement is GCS-side and therefore deploy-time verified; the
    // emulator cannot exercise it (no v4 PUT support).
    expect(issued.requiredHeaders["x-goog-if-generation-match"]).toBe("0");

    // The Storage emulator does not implement v4 signed-URL PUTs (it answers
    // 501), so the bytes are landed the way the signed PUT would: same path,
    // same content type, and exactly the customerId metadata the issued
    // requiredHeaders demand. The no-direct-client-write property itself is
    // enforced by storage.rules (write: if false) and asserted below; real
    // GCS signature/content-type enforcement is a deploy-time check, same as
    // every existing signed-URL flow in this repo (none are emulator-PUT
    // covered).
    // The client SDK's default bucket here is gs://<projectId>; the backend
    // (and production clients) use <projectId>.appspot.com, so land and read
    // the bytes on that exact bucket or the attach-time check cannot see it.
    const bucketUrl = "gs://autodeck-dev.appspot.com";
    await storageEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage(bucketUrl).ref(issued.path).put(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        contentType: "image/jpeg",
        customMetadata: { customerId },
      });
    });

    // Server-side truth: the object exists with the owner binding metadata.
    await storageEnv.withSecurityRulesDisabled(async (ctx) => {
      const meta = await ctx.storage(bucketUrl).ref(issued.path).getMetadata();
      expect(meta.customMetadata?.["customerId"]).toBe(customerId);
      expect(meta.contentType).toBe("image/jpeg");
    });

    // Rules on the authenticated read path. The frontend's contract is
    // getBytes/getBlob (firebase JS SDK v10, verified present in the app's
    // dependency) - every read is rules-evaluated and no bearer-token URL is
    // ever minted. This test asserts the same storage.objects read gate via
    // getMetadata, because the rules-unit-testing compat Reference does not
    // expose getBytes; the rules decision is identical for bytes and
    // metadata (both are `allow read`).
    const reader = (uid2: string, claims: Record<string, unknown>) => storageEnv.authenticatedContext(uid2, claims).storage(bucketUrl);
    await assertSucceeds(reader(staffUid, { role: "studio", tenantId: TENANT_A, studioId: STUDIO_A }).ref(issued.path).getMetadata());
    await assertSucceeds(reader(customerId, { role: "customer", tenantId: TENANT_A, studioId: null }).ref(issued.path).getMetadata());
    await assertFails(reader(uid("other-cust"), { role: "customer", tenantId: TENANT_A, studioId: null }).ref(issued.path).getMetadata());
    await assertFails(Promise.resolve(reader(customerId, { role: "customer", tenantId: TENANT_A, studioId: null }).ref(issued.path).put(new Uint8Array([1]))));

    // The inspection accepts exactly this path and keeps it.
    await updateInspection.run({ data: { jobId: job.id, addPhotos: [issued.path] }, auth: staff } as never);
    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect(snap.data()?.photos).toEqual([issued.path]);
  }, 30000);
});

// ─── 5. Attendance callables across the real day-state machine ───────────────

import { checkInAttendance } from "../../functions/attendance/checkInAttendance.js";
import { startAttendanceBreak } from "../../functions/attendance/startAttendanceBreak.js";
import { endAttendanceBreak } from "../../functions/attendance/endAttendanceBreak.js";
import { checkOutAttendance } from "../../functions/attendance/checkOutAttendance.js";
import type { Employee } from "@autodeck/core";

async function seedEmployee(authUid: string, studioId: string | null, tenantId = TENANT_A, role: "studio" | "admin" = "studio") {
  const now = new Date().toISOString();
  const employee: Employee = {
    id: uid("emp"),
    tenantId,
    studioId,
    authUid,
    email: `${authUid}@test.example`,
    name: `Test ${authUid}`,
    phone: "+919999999999",
    role,
    active: true,
    createdAt: now,
    updatedAt: now,
    terminatedAt: null,
  };
  await db.collection(COLLECTIONS.employees()).doc(employee.id).set(employee);
  return employee;
}

describe("attendance callables - day state machine", () => {
  it("check-in creates PRESENT with no checkout and no breaks; a second check-in is already-exists", async () => {
    const staffUid = uid("staff");
    await seedEmployee(staffUid, STUDIO_A);
    const auth = studioAuth(staffUid);
    const first = (await checkInAttendance.run({ data: {}, auth } as never)) as { id: string };
    const snap = await db.collection(COLLECTIONS.attendance()).doc(first.id).get();
    const rec = snap.data()!;
    expect(rec.status).toBe("PRESENT");
    expect(rec.checkOutAt).toBeNull();
    expect(rec.breaks).toEqual([]);
    await expectErr(checkInAttendance.run({ data: {}, auth } as never), "already-exists");
  });

  it("break: start OK, repeat start already-exists, checkout during break failed-precondition, end OK, repeat end failed-precondition", async () => {
    const staffUid = uid("staff");
    await seedEmployee(staffUid, STUDIO_A);
    const auth = studioAuth(staffUid);
    await checkInAttendance.run({ data: {}, auth } as never);

    await startAttendanceBreak.run({ data: {}, auth } as never);
    await expectErr(startAttendanceBreak.run({ data: {}, auth } as never), "already-exists");
    await expectErr(checkOutAttendance.run({ data: {}, auth } as never), "failed-precondition", "End the current break");
    await endAttendanceBreak.run({ data: {}, auth } as never);
    await expectErr(endAttendanceBreak.run({ data: {}, auth } as never), "failed-precondition", "No break is in progress");
  });

  it("checkout computes workedMinutes net of breaks; repeat checkout already-exists; startBreak after checkout failed-precondition", async () => {
    const staffUid = uid("staff");
    await seedEmployee(staffUid, STUDIO_A);
    const auth = studioAuth(staffUid);
    await checkInAttendance.run({ data: {}, auth } as never);
    await startAttendanceBreak.run({ data: {}, auth } as never);
    await new Promise((r) => setTimeout(r, 1200));
    await endAttendanceBreak.run({ data: {}, auth } as never);

    const out = (await checkOutAttendance.run({ data: {}, auth } as never)) as { workedMinutes: number };
    expect(out.workedMinutes).toBeGreaterThanOrEqual(0);
    const snap = await db.collection(COLLECTIONS.attendance()).doc((await checkInDocId(staffUid))).get();
    expect(snap.data()?.workedMinutes).toBe(out.workedMinutes);
    await expectErr(checkOutAttendance.run({ data: {}, auth } as never), "already-exists");
    await expectErr(startAttendanceBreak.run({ data: {}, auth } as never), "failed-precondition", "Already checked out");
  });

  async function checkInDocId(staffUid: string): Promise<string> {
    const emp = await db.collection(COLLECTIONS.employees()).where("authUid", "==", staffUid).limit(1).get();
    const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return `${TENANT_A}__${emp.docs[0]!.id}__${date}`;
  }

  it("with no check-in, start/end break and checkout are all failed-precondition", async () => {
    const staffUid = uid("staff");
    await seedEmployee(staffUid, STUDIO_A);
    const auth = studioAuth(staffUid);
    await expectErr(startAttendanceBreak.run({ data: {}, auth } as never), "failed-precondition", "No check-in");
    await expectErr(endAttendanceBreak.run({ data: {}, auth } as never), "failed-precondition", "No check-in");
    await expectErr(checkOutAttendance.run({ data: {}, auth } as never), "failed-precondition", "No check-in");
  });

  it("a studio account with no active roster record is permission-denied on all four", async () => {
    const auth = studioAuth(uid("ghost"));
    await expectErr(checkInAttendance.run({ data: {}, auth } as never), "permission-denied");
    await expectErr(startAttendanceBreak.run({ data: {}, auth } as never), "permission-denied");
    await expectErr(endAttendanceBreak.run({ data: {}, auth } as never), "permission-denied");
    await expectErr(checkOutAttendance.run({ data: {}, auth } as never), "permission-denied");
  });

  it("a tenant admin (studioId null roster) cannot self check in: failed-precondition", async () => {
    const adminUid = uid("tadmin");
    await seedEmployee(adminUid, null, TENANT_A, "admin");
    const auth = { uid: adminUid, token: { role: "admin", tenantId: TENANT_A, studioId: null }, rawToken: "test" };
    await expectErr(checkInAttendance.run({ data: {}, auth } as never), "failed-precondition", "not studio-scoped");
  });
});

// ─── 6. Pickup leg progress (additive visibility) ───────────────────────────

describe("updatePickupRequest - markLegCompleted leg progress", () => {
  let service: Service;

  beforeAll(async () => {
    await seedStudio(STUDIO_A, TENANT_A);
    service = await seedService(uid("svc"), TENANT_A);
  });

  async function confirmedRequest(kind: "pickup" | "drop" | "both") {
    const { job, booking, customerId } = await freshJob(service);
    await requestPickupDrop.run({
      data: { bookingId: booking.id, kind, address: "12, Test Society, Ahmedabad 380006" },
      auth: customerAuth(customerId),
    } as never);
    await updatePickupRequest.run({
      data: { requestId: booking.id, status: "REQUESTED", feePaise: 20000 },
      auth: adminAuth(uid("admin")),
    } as never);
    const timing: Record<string, string> = {};
    if (kind !== "drop") timing["agreedPickupAt"] = `${nextDate()} 10:30`;
    if (kind !== "pickup") timing["agreedDropAt"] = `${nextDate()} 18:00`;
    await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", ...timing },
      auth: studioAuth(uid("staff")),
    } as never);
    return { job, booking, customerId };
  }

  it("stamps each leg server-side; repeat marks are idempotent; status, job state and price stay untouched", async () => {
    const { job, booking } = await confirmedRequest("both");
    const staff = studioAuth(uid("staff"));
    const jobBefore = (await db.collection(COLLECTIONS.jobs()).doc(job.id).get()).data() as ServiceJob;

    const r1 = (await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", markLegCompleted: "pickup" },
      auth: staff,
    } as never)) as { pickupCompletedAt: string | null; dropCompletedAt: string | null; idempotent: boolean };
    expect(r1.idempotent).toBe(false);
    expect(r1.pickupCompletedAt).toBeTruthy();
    expect(r1.dropCompletedAt).toBeNull();

    // Double-tap: same timestamp back, flagged idempotent, no overwrite.
    const r2 = (await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", markLegCompleted: "pickup" },
      auth: staff,
    } as never)) as { pickupCompletedAt: string | null; idempotent: boolean };
    expect(r2.idempotent).toBe(true);
    expect(r2.pickupCompletedAt).toBe(r1.pickupCompletedAt);

    const r3 = (await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", markLegCompleted: "drop" },
      auth: staff,
    } as never)) as { dropCompletedAt: string | null };
    expect(r3.dropCompletedAt).toBeTruthy();

    // Visibility only: request still CONFIRMED, job untouched (no DELIVERED, no charge).
    const reqSnap = await db.collection(COLLECTIONS.pickupRequests()).doc(booking.id).get();
    expect(reqSnap.data()?.status).toBe("CONFIRMED");
    const jobAfter = (await db.collection(COLLECTIONS.jobs()).doc(job.id).get()).data() as ServiceJob;
    expect(jobAfter.status).toBe(jobBefore.status);
    expect(jobAfter.totalAmount).toBe(jobBefore.totalAmount);
    expect(jobAfter.priceBreakdown).toEqual(jobBefore.priceBreakdown);

    // The existing manual DONE gate is unaffected and still works.
    const done = (await updatePickupRequest.run({ data: { requestId: booking.id, status: "DONE" }, auth: staff } as never)) as { status: string };
    expect(done.status).toBe("DONE");
    // A completed leg cannot move again once the request is closed (no reopen).
    await expectErr(
      updatePickupRequest.run({ data: { requestId: booking.id, status: "DONE", markLegCompleted: "pickup" }, auth: staff } as never),
      "failed-precondition",
    );
    const after = await db.collection(COLLECTIONS.pickupRequests()).doc(booking.id).get();
    expect(after.data()?.pickupCompletedAt).toBe(r1.pickupCompletedAt);
  });

  it("guards: unconfirmed request, wrong leg for kind, customer, cross-studio all rejected", async () => {
    const { booking, customerId } = await freshJob(service);
    await requestPickupDrop.run({
      data: { bookingId: booking.id, kind: "pickup", address: "12, Test Society, Ahmedabad 380006" },
      auth: customerAuth(customerId),
    } as never);
    // Still REQUESTED - nothing in motion.
    await expectErr(
      updatePickupRequest.run({ data: { requestId: booking.id, status: "REQUESTED", markLegCompleted: "pickup" }, auth: studioAuth(uid("staff")) } as never),
      "failed-precondition",
    );
    // Confirm it (kind: pickup only).
    await updatePickupRequest.run({ data: { requestId: booking.id, status: "REQUESTED", feePaise: 10000 }, auth: adminAuth(uid("admin")) } as never);
    await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", agreedPickupAt: `${nextDate()} 10:30` },
      auth: studioAuth(uid("staff")),
    } as never);
    // This request has no drop leg.
    await expectErr(
      updatePickupRequest.run({ data: { requestId: booking.id, status: "CONFIRMED", markLegCompleted: "drop" }, auth: studioAuth(uid("staff")) } as never),
      "invalid-argument",
    );
    // Customers cannot mark legs.
    await expectErr(
      updatePickupRequest.run({ data: { requestId: booking.id, status: "CONFIRMED", markLegCompleted: "pickup" }, auth: customerAuth(customerId) } as never),
      "permission-denied",
    );
    // Another studio's staff cannot mark legs on this studio's request.
    await seedStudio("sbb-studio-other", TENANT_A);
    await expectErr(
      updatePickupRequest.run({ data: { requestId: booking.id, status: "CONFIRMED", markLegCompleted: "pickup" }, auth: studioAuth(uid("staff"), "sbb-studio-other") } as never),
      "permission-denied",
    );
  });
});

// ─── 7. recordManualPayment replay + in-flight guards (emulator proof) ──────

describe("recordManualPayment - replay and in-flight payment guards", () => {
  let service: Service;

  beforeAll(async () => {
    await seedStudio(STUDIO_A, TENANT_A);
    service = await seedService(uid("svc"), TENANT_A);
  });

  it("exact replay (batch12 double-click payload) records exactly one payment at the server-side job total", async () => {
    const { job } = await freshJob(service);
    // Contract: recordManualPayment.ts "Office policy (28 Oct 2026, explicit owner decision for UPI)": a one-step UPI record is
    // office-only, so the replay is exercised as the office. Staff rejection is asserted in the next test.
    const office = adminAuth(uid("office"));
    const payload = { data: { jobId: job.id, method: "upi_manual", manualReference: "utr-123" }, auth: office } as never;

    const r1 = (await recordManualPayment.run(payload)) as { paymentId: string; invoiceId: string };
    const paySnap = await db.collection(COLLECTIONS.payments()).doc(r1.paymentId).get();
    expect(paySnap.data()?.amount).toBe(job.totalAmount); // amount is server-side, never client input
    expect(paySnap.data()?.manualReference).toBe("utr-123");
    expect(paySnap.data()?.status).toBe("completed");

    // Same-tick retry with the identical payload: rejected, and nothing new is written.
    await expectErr(recordManualPayment.run(payload), "already-exists");
    const pays = await db.collection(COLLECTIONS.payments()).where("jobId", "==", job.id).get();
    expect(pays.size).toBe(1);
    const invoices = await db.collection(COLLECTIONS.invoices()).where("jobId", "==", job.id).get();
    expect(invoices.size).toBe(1);
  });

  it("staff one-step UPI record is refused and writes nothing (office-only per the 28 Oct owner decision); staff cash is unaffected", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    await expectErr(recordManualPayment.run({ data: { jobId: job.id, method: "upi_manual", manualReference: "utr-9" }, auth: staff } as never), "permission-denied");
    const pays = await db.collection(COLLECTIONS.payments()).where("jobId", "==", job.id).get();
    expect(pays.size).toBe(0);
  });

  it("blocks while another payment is in flight for the job (pending gateway window)", async () => {
    const { job, customerId } = await freshJob(service);
    const now = new Date().toISOString();
    await db.collection(COLLECTIONS.payments()).doc(uid("pay")).set({
      tenantId: job.tenantId,
      studioId: job.studioId,
      targetType: "job",
      jobId: job.id,
      bookingId: job.bookingId,
      customerId,
      amount: job.totalAmount,
      currency: "INR",
      method: "razorpay_link",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await expectErr(
      recordManualPayment.run({ data: { jobId: job.id, method: "cash" }, auth: studioAuth(uid("staff")) } as never),
      "already-exists",
    );
  });
});

// ─── 8. Create-only upload precondition (overwrite/reuse threat) ────────────

describe("photo object create-only semantics (the signed URL's x-goog-if-generation-match: 0)", () => {
  // VERIFIED GAP: the storage emulator ignores ifGenerationMatch
  // preconditions (the overwrite below resolves when run). Create-only
  // enforcement therefore has NO emulator proof - it rests on the GCS
  // documentation for x-goog-if-generation-match: 0 (412 on a second PUT)
  // and must be verified at deploy time against real GCS. This test is kept
  // skipped as executable documentation: if the emulator ever starts
  // enforcing preconditions, unskip it for continuous proof.
  it.skip("first create succeeds; rewriting an existing object under the same precondition fails", async () => {
    // The issued signed PUT URL signs x-goog-if-generation-match: 0, which
    // GCS enforces as create-only (412 on any second PUT) - so an
    // already-attached, already-verified photo cannot be overwritten inside
    // or after the URL's 10-minute window, including after finalize. The
    // emulator-level proof here uses the same precondition primitive through
    // the Admin SDK; GCS-side enforcement of the signed header is
    // doc-grounded (request-preconditions, XML API reference) and a
    // deploy-time check, since the storage emulator cannot do v4 PUTs.
    const path = `${TENANT_A}/jobs/${uid("job")}/photos/create-only.jpg`;
    const file = getStorage().bucket().file(path);
    await file.save(Buffer.from("first"), {
      metadata: { contentType: "image/jpeg", metadata: { customerId: "c1" } },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
    await expect(
      file.save(Buffer.from("OVERWRITTEN"), {
        metadata: { contentType: "image/jpeg", metadata: { customerId: "c1" } },
        preconditionOpts: { ifGenerationMatch: 0 },
      }),
    ).rejects.toThrow();
    // The original bytes survived the rejected overwrite.
    const [buf] = await file.download();
    expect(buf.toString()).toBe("first");
  });
});
