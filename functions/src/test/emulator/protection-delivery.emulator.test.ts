/**
 * ACTUAL callable lifecycle evidence for staff-declared protection work at
 * DELIVERED, against the real Firestore emulator via advanceJobStatus.run()
 * (same pattern as approval.emulator.test.ts). Fresh isolated fixtures per
 * test (clearFirestore). No photo, no device, no live cloud - local
 * emulators only.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";
import { TEST_PROJECT_ID } from "../emulator-setup";

const db = getFirestore();
const TENANT = "pd-tenant";
const STUDIO = "pd-studio";
const CUSTOMER = "pd-customer";
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: { rules: readFileSync(resolve(__dirname, "../../../../firestore.rules"), "utf8"), host: "localhost", port: Number(process.env["FIRESTORE_EMULATOR_HOST"]?.split(":").at(-1) ?? 8080) },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const studioAuth = (uid: string, tenantId = TENANT, studioId = STUDIO) => ({ uid, token: { role: "studio", tenantId, studioId } });

let seq = 0;
async function seedDeliverable(over: Record<string, unknown> = {}) {
  seq += 1;
  const id = `pd-job-${Date.now()}-${seq}`;
  const vehicleId = `pd-veh-${seq}`;
  await db.collection("vehicles").doc(vehicleId).set({
    id: vehicleId, tenantId: TENANT, ownerId: CUSTOMER, registrationNumber: "GJ01AB1234",
    make: "Honda", model: "City", year: 2022, color: "White", photoUrl: null, deletedAt: null,
  });
  await db.collection("jobs").doc(id).set({
    id, tenantId: TENANT, studioId: STUDIO, customerId: CUSTOMER, vehicleId,
    serviceId: "pd-svc-none", status: "READY_FOR_DELIVERY", paymentStatus: "paid",
    totalAmount: 10000, bookingId: null, scheduledAt: "2026-10-31T10:00:00.000Z",
    statusHistory: [], createdAt: "x", updatedAt: "x", ...over,
  });
  await db.collection("invoices").doc(`pd-inv-${seq}`).set({
    id: `pd-inv-${seq}`, tenantId: TENANT, jobId: id, customerId: CUSTOMER, vehicleId,
    status: "issued", total: 10000, lineItems: [],
  });
  return { id, vehicleId };
}
const protections = (vehicleId: string) => db.collection(`vehicles/${vehicleId}/protections`);

describe("advanceJobStatus DELIVERED protection declaration (real emulator, callable)", () => {
  it("explicit-none declaration ([]): job delivers, no protection records are created", async () => {
    const { id, vehicleId } = await seedDeliverable();
    await advanceJobStatus.run({ data: { jobId: id, protectionWork: [] }, auth: studioAuth("pd-staff-1") } as never);
    const job = (await db.collection("jobs").doc(id).get()).data()!;
    expect(job.status).toBe("DELIVERED");
    expect(job.protectionWork).toEqual([]);
    expect((await protections(vehicleId).get()).empty).toBe(true);
  });

  it("missing declaration (field absent): rejected, job not delivered, no records", async () => {
    const { id, vehicleId } = await seedDeliverable();
    await expect(advanceJobStatus.run({ data: { jobId: id }, auth: studioAuth("pd-staff-1") } as never)).rejects.toThrow(/protection work declaration/i);
    expect((await db.collection("jobs").doc(id).get()).data()!.status).toBe("READY_FOR_DELIVERY");
    expect((await protections(vehicleId).get()).empty).toBe(true);
  });

  it("install declaration creates exactly one current record at the deterministic event id, bound to tenant/vehicle/customer", async () => {
    const { id, vehicleId } = await seedDeliverable();
    await advanceJobStatus.run({
      data: { jobId: id, protectionWork: [{ action: "install", kind: "ppf", coverage: "full_body", brand: "Xpel", warrantyYears: 5 }] },
      auth: studioAuth("pd-staff-1"),
    } as never);
    const doc = await protections(vehicleId).doc(`job-${id}-ev0`).get();
    expect(doc.exists).toBe(true);
    const rec = doc.data()!;
    expect(rec.lifecycle).toBe("current");
    expect(rec.kind).toBe("ppf");
    expect(rec.coverage).toBe("full_body");
    expect(rec.provider).toBe("Xpel");
    expect(rec.warrantyYears).toBe(5);
    expect(rec.tenantId).toBe(TENANT);
    expect(rec.vehicleId).toBe(vehicleId);
    expect(rec.customerId).toBe(CUSTOMER);
    expect(rec.installedByJobId).toBe(id);
    expect(rec.source).toBe("autodeck");
    expect(rec.revision).toBe(1);
  });

  it("replace supersedes the named current record (history kept, revision bumped) and installs the successor like-for-like", async () => {
    const { id, vehicleId } = await seedDeliverable();
    await protections(vehicleId).doc("pd-old").set({
      id: "pd-old", tenantId: TENANT, vehicleId, customerId: CUSTOMER, kind: "ceramic",
      coverage: "full_front", provider: "Old", warrantyYears: 3, status: "verified",
      source: "customer", revision: 3, createdAt: "x", updatedAt: "x",
    });
    await advanceJobStatus.run({
      data: { jobId: id, protectionWork: [{ action: "replace", targetProtectionId: "pd-old", expectedRevision: 3, kind: "ceramic", coverage: "full_front", brand: "New", warrantyYears: 2 }] },
      auth: studioAuth("pd-staff-1"),
    } as never);
    const oldRec = (await protections(vehicleId).doc("pd-old").get()).data()!;
    expect(oldRec.lifecycle).toBe("superseded");
    expect(oldRec.supersededByJobId).toBe(id);
    expect(oldRec.revision).toBe(4);
    expect(oldRec.source).toBe("customer"); // provenance preserved
    const newRec = (await protections(vehicleId).doc(`job-${id}-ev0`).get()).data()!;
    expect(newRec.lifecycle).toBe("current");
    expect(newRec.kind).toBe("ceramic");
  });

  it("stale expectedRevision fails closed: nothing delivered, nothing superseded", async () => {
    const { id, vehicleId } = await seedDeliverable();
    await protections(vehicleId).doc("pd-old").set({
      id: "pd-old", tenantId: TENANT, vehicleId, customerId: CUSTOMER, kind: "ppf",
      coverage: "full_body", provider: "Old", warrantyYears: 3, status: "verified",
      source: "autodeck", revision: 3, createdAt: "x", updatedAt: "x",
    });
    await expect(advanceJobStatus.run({
      data: { jobId: id, protectionWork: [{ action: "replace", targetProtectionId: "pd-old", expectedRevision: 2, kind: "ppf", coverage: "full_body", brand: "New", warrantyYears: 2 }] },
      auth: studioAuth("pd-staff-1"),
    } as never)).rejects.toThrow(/changed since it was reviewed/i);
    expect((await db.collection("jobs").doc(id).get()).data()!.status).toBe("READY_FOR_DELIVERY");
    expect((await protections(vehicleId).doc("pd-old").get()).data()!.lifecycle ?? "current").toBe("current");
  });

  it("remove retires the named record as history (kept, never deleted)", async () => {
    const { id, vehicleId } = await seedDeliverable();
    await protections(vehicleId).doc("pd-rm").set({
      id: "pd-rm", tenantId: TENANT, vehicleId, customerId: CUSTOMER, kind: "ppf",
      coverage: "high_impact", provider: "Old", warrantyYears: null, status: "verified",
      source: "autodeck", revision: 0, createdAt: "x", updatedAt: "x",
    });
    await advanceJobStatus.run({
      data: { jobId: id, protectionWork: [{ action: "remove", targetProtectionId: "pd-rm", expectedRevision: 0 }] },
      auth: studioAuth("pd-staff-1"),
    } as never);
    const doc = await protections(vehicleId).doc("pd-rm").get();
    expect(doc.exists).toBe(true);
    expect(doc.data()!.lifecycle).toBe("removed");
    expect(doc.data()!.removedByJobId).toBe(id);
  });

  it("a non-cosmetic target (insurance record) can never be retired by a delivery declaration", async () => {
    const { id, vehicleId } = await seedDeliverable();
    await protections(vehicleId).doc("pd-ins").set({
      id: "pd-ins", tenantId: TENANT, vehicleId, customerId: CUSTOMER, kind: "insurance",
      provider: "ICICI", policyNumber: "P-1", status: "verified", source: "customer",
      revision: 0, createdAt: "x", updatedAt: "x",
    });
    await expect(advanceJobStatus.run({
      data: { jobId: id, protectionWork: [{ action: "remove", targetProtectionId: "pd-ins", expectedRevision: 0 }] },
      auth: studioAuth("pd-staff-1"),
    } as never)).rejects.toThrow(/not cosmetic protection/i);
    expect((await protections(vehicleId).doc("pd-ins").get()).data()!.lifecycle ?? "current").toBe("current");
  });

  it("cross-tenant studio is denied; the job and records are untouched", async () => {
    const { id, vehicleId } = await seedDeliverable();
    await expect(advanceJobStatus.run({
      data: { jobId: id, protectionWork: [] }, auth: studioAuth("pd-staff-x", "pd-tenant-b", STUDIO),
    } as never)).rejects.toThrow();
    expect((await db.collection("jobs").doc(id).get()).data()!.status).toBe("READY_FOR_DELIVERY");
    expect((await protections(vehicleId).get()).empty).toBe(true);
  });

  it("unpaid job with a declaration: payment gate fires first, nothing delivered", async () => {
    const { id, vehicleId } = await seedDeliverable({ paymentStatus: "unpaid" });
    await expect(advanceJobStatus.run({
      data: { jobId: id, protectionWork: [{ action: "install", kind: "ppf", coverage: "full_body", brand: null, warrantyYears: null }] },
      auth: studioAuth("pd-staff-1"),
    } as never)).rejects.toThrow(/payment/i);
    expect((await db.collection("jobs").doc(id).get()).data()!.status).toBe("READY_FOR_DELIVERY");
    expect((await protections(vehicleId).get()).empty).toBe(true);
  });
});
