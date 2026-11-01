/**
 * Admin correction flow against the REAL callable (updateProtection.run) on
 * the real Firestore emulator, fresh isolated fixtures per test. History is
 * immutable, corrections fail closed on a stale revision, scope repair is
 * cosmetic-only, and ownership/tenant are never reassigned. Local emulators
 * only - no live cloud, no real data.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import { updateProtection } from "../../functions/protection/updateProtection.js";

const db = getFirestore();
const TENANT = "ac-tenant";
const VEHICLE = "ac-veh";
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "autodeck-dev",
    firestore: { rules: readFileSync(resolve(__dirname, "../../../../firestore.rules"), "utf8"), host: "localhost", port: Number(process.env["FIRESTORE_EMULATOR_HOST"]?.split(":").at(-1) ?? 8080) },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await db.collection("vehicles").doc(VEHICLE).set({
    id: VEHICLE, tenantId: TENANT, ownerId: "ac-customer", registrationNumber: "GJ01AB1234",
    make: "Honda", model: "City", year: 2022, color: "White", photoUrl: null, deletedAt: null,
  });
});

const adminAuth = (uid: string, tenantId = TENANT) => ({ uid, token: { role: "admin", tenantId, studioId: null } });
const ref = (id: string) => db.collection(`vehicles/${VEHICLE}/protections`).doc(id);
const codeOf = (e: unknown) => (e as { code?: string })?.code ?? String(e);

async function seed(id: string, over: Record<string, unknown> = {}) {
  await ref(id).set({
    id, tenantId: TENANT, vehicleId: VEHICLE, customerId: "ac-customer", kind: "ppf",
    coverage: "full_body", provider: "Old", policyNumber: null, startDate: null,
    expiryDate: null, warrantyYears: 3, status: "unverified", source: "customer",
    revision: 1, createdAt: "x", updatedAt: "x", ...over,
  });
}

describe("updateProtection admin correction (real emulator, callable)", () => {
  it("corrects fields + repairs cosmetic scope: revision bumps, provenance kept, audit carries before/after with coverage", async () => {
    await seed("ac-1", { coverage: null }); // unknown scope repaired explicitly
    await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-1", expectedRevision: 1, coverage: "full_front", provider: "Xpel" }, auth: adminAuth("ac-admin") } as never);
    const rec = (await ref("ac-1").get()).data()!;
    expect(rec.coverage).toBe("full_front");
    expect(rec.provider).toBe("Xpel");
    expect(rec.revision).toBe(2);
    expect(rec.customerId).toBe("ac-customer"); // never reassigned
    expect(rec.source).toBe("customer"); // provenance preserved
    const audits = (await db.collection("auditLog").where("entityId", "==", "ac-1").get()).docs.map((d) => d.data());
    const entry = audits.find((a) => a.action === "protection.updated")!;
    expect(entry).toBeDefined();
    expect((entry as { performedBy?: string }).performedBy).toBe("ac-admin");
    expect((entry.before as { coverage?: unknown }).coverage ?? null).toBeNull();
    expect((entry.after as { coverage?: unknown }).coverage).toBe("full_front");
  });

  it("stale expectedRevision fails closed: record untouched", async () => {
    await seed("ac-2");
    const before = (await ref("ac-2").get()).data()!;
    const err = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-2", expectedRevision: 0, provider: "New" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(err)).toBe("failed-precondition");
    expect((await ref("ac-2").get()).data()).toEqual(before);
  });

  it("history records are immutable: superseded and removed both reject correction", async () => {
    await seed("ac-3", { lifecycle: "superseded", supersededByJobId: "job-x", revision: 4 });
    await seed("ac-4", { lifecycle: "removed", removedByJobId: "job-y", revision: 2 });
    for (const [id, rev] of [["ac-3", 4], ["ac-4", 2]] as const) {
      const before = (await ref(id).get()).data()!;
      const err = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: id, expectedRevision: rev, provider: "New" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
      expect(codeOf(err)).toBe("failed-precondition");
      expect((await ref(id).get()).data()).toEqual(before);
    }
  });

  it("coverage repair is cosmetic-only: an insurance record rejects it", async () => {
    await seed("ac-5", { kind: "insurance", policyNumber: "P-1", coverage: null });
    const err = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-5", expectedRevision: 1, coverage: "full_body" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(err)).toBe("failed-precondition");
    expect((await ref("ac-5").get()).data()!.coverage ?? null).toBeNull();
  });

  it("legacy record with NO revision field: base 0 requires the reviewed record's updatedAt fingerprint", async () => {
    await ref("ac-6").set({
      id: "ac-6", tenantId: TENANT, vehicleId: VEHICLE, customerId: "ac-customer", kind: "ceramic",
      coverage: "high_impact", provider: "Old", status: "unverified", source: "autodeck",
      createdAt: "x", updatedAt: "x",
    });
    // Wrong elected base WITH the correct fingerprint: only the
    // expectedRevision guard can be the one that fires (un-confounded).
    const bad = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-6", expectedRevision: 1, legacyBaseUpdatedAt: "x", notes: "x" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(bad)).toBe("failed-precondition");
    // base 0 without the fingerprint fails closed (missing revision is not a
    // silent 0), and a WRONG fingerprint (a concurrent unversioned change)
    // fails closed too.
    const noFp = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-6", expectedRevision: 0, notes: "x" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(noFp)).toBe("failed-precondition");
    const wrongFp = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-6", expectedRevision: 0, legacyBaseUpdatedAt: "stale", notes: "x" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(wrongFp)).toBe("failed-precondition");
    await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-6", expectedRevision: 0, legacyBaseUpdatedAt: "x", notes: "checked" }, auth: adminAuth("ac-admin") } as never);
    expect((await ref("ac-6").get()).data()!.revision).toBe(1);
    // The fingerprint is an exact non-blank STRING match: a legacy record
    // whose updatedAt is not a string (e.g. a number from a bad import) can
    // never match a string fingerprint and fails closed.
    await ref("ac-6b").set({
      id: "ac-6b", tenantId: TENANT, vehicleId: VEHICLE, customerId: "ac-customer", kind: "ceramic",
      coverage: null, provider: "Old", status: "unverified", source: "autodeck",
      createdAt: 1, updatedAt: 2,
    });
    const nonString = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-6b", expectedRevision: 0, legacyBaseUpdatedAt: "2", notes: "x" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(nonString)).toBe("failed-precondition");
  });

  it("fresh parent gate: archived, owner-mismatched, and tenant-moved vehicles all reject; a real revision 0 is not treated as missing", async () => {
    // archived parent - and the rejected correction leaves the WHOLE record equal
    await seed("ac-10");
    const beforeArchived = (await ref("ac-10").get()).data();
    await db.collection("vehicles").doc(VEHICLE).update({ deletedAt: "2026-01-01" });
    const archived = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-10", expectedRevision: 1, notes: "x" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(archived)).toBe("failed-precondition");
    expect((await ref("ac-10").get()).data()).toEqual(beforeArchived);
    await db.collection("vehicles").doc(VEHICLE).update({ deletedAt: null });
    // owner mismatch: the car moved, the record still names the old customer
    await db.collection("vehicles").doc(VEHICLE).update({ ownerId: "ac-buyer" });
    const moved = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-10", expectedRevision: 1, notes: "x" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(moved)).toBe("failed-precondition");
    await db.collection("vehicles").doc(VEHICLE).update({ ownerId: "ac-customer" });
    // tenant-moved parent
    await db.collection("vehicles").doc(VEHICLE).update({ tenantId: "ac-tenant-b" });
    const tMoved = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-10", expectedRevision: 1, notes: "x" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(tMoved)).toBe("failed-precondition");
    await db.collection("vehicles").doc(VEHICLE).update({ tenantId: TENANT });
    // missing parent entirely: fails closed, never repairs
    await db.collection("vehicles").doc(VEHICLE).delete();
    const noParent = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-10", expectedRevision: 1, notes: "x" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(noParent)).toBe("failed-precondition");
    // restore the parent (seed shape) for the path-mismatch case
    await db.collection("vehicles").doc(VEHICLE).set({ id: VEHICLE, tenantId: TENANT, ownerId: "ac-customer" });
    // record whose OWN vehicleId disagrees with the path: fails closed
    await seed("ac-12", { vehicleId: "ac-other-car" });
    const wrongPath = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-12", expectedRevision: 1, notes: "x" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(wrongPath)).toBe("failed-precondition");
    // a REAL revision 0 takes the normal path - no fingerprint demanded
    await seed("ac-11", { revision: 0 });
    await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-11", expectedRevision: 0, notes: "real zero" }, auth: adminAuth("ac-admin") } as never);
    expect((await ref("ac-11").get()).data()!.revision).toBe(1);
  });

  it("cross-tenant admin and customer role are both denied; record untouched", async () => {
    await seed("ac-7");
    const before = (await ref("ac-7").get()).data()!;
    const cross = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-7", expectedRevision: 1, provider: "N" }, auth: adminAuth("ac-admin-b", "ac-tenant-b") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(cross)).toBe("permission-denied");
    const cust = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-7", expectedRevision: 1, provider: "N" }, auth: { uid: "ac-customer", token: { role: "customer", tenantId: TENANT, studioId: null } } } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(cust)).toBe("permission-denied");
    expect((await ref("ac-7").get()).data()).toEqual(before);
  });

  it("identity fields are not client-writable: customerId in the payload fails validation", async () => {
    await seed("ac-8");
    const err = await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-8", expectedRevision: 1, customerId: "someone-else" }, auth: adminAuth("ac-admin") } as never).then(() => null, (e: unknown) => e);
    expect(codeOf(err)).toBe("invalid-argument");
    expect((await ref("ac-8").get()).data()!.customerId).toBe("ac-customer");
  });

  it("explicit null CLEARS a stored value at runtime (not a silent keep)", async () => {
    await seed("ac-13", { provider: "Garware", notes: "keep-me-not", policyNumber: "P-9" });
    await updateProtection.run({
      data: { vehicleId: VEHICLE, protectionId: "ac-13", expectedRevision: 1, provider: null, notes: null },
      auth: adminAuth("ac-admin"),
    } as never);
    const after = (await ref("ac-13").get()).data()!;
    expect(after.provider).toBeNull();
    expect(after.notes).toBeNull();
    expect(after.policyNumber).toBe("P-9"); // omitted key: untouched
  });

  it("verification stamps verifiedBy/verifiedAt and audits protection.verified", async () => {
    await seed("ac-9");
    await updateProtection.run({ data: { vehicleId: VEHICLE, protectionId: "ac-9", expectedRevision: 1, status: "verified" }, auth: adminAuth("ac-admin") } as never);
    const rec = (await ref("ac-9").get()).data()!;
    expect(rec.status).toBe("verified");
    expect(rec.verifiedBy).toBe("ac-admin");
    expect(rec.verifiedAt).toBeTruthy();
    expect(rec.revision).toBe(2);
    const audits = (await db.collection("auditLog").where("entityId", "==", "ac-9").get()).docs.map((d) => d.data());
    expect(audits.some((a) => a.action === "protection.verified")).toBe(true);
  });
});
