/**
 * Intended scope: the admin Cars lookup reads a car's customer documents (papers) and studio papers
 * (vehicles/{id}/protections) with LIST queries. Firestore rules only allow a list query that
 * provably stays inside the caller's tenant, so each query must filter by tenantId. This runs the same
 * query shapes as apps/admin getVehiclePapers / getVehicleProtections against the real firestore.rules:
 * own-tenant filtered queries succeed, unfiltered or other-tenant queries are denied, customers cannot
 * use the staff query. Regression guard for the "Search failed" on the Cars page.
 */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FIRST_TENANT_ID } from "@autodeck/core";

const RULES_PATH = resolve(__dirname, "../../../../firestore.rules");
const OTHER = "other-tenant";
const VEH = "veh-lookup-1";
let testEnv: RulesTestEnvironment;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: "autodeck-dev", firestore: { rules: readFileSync(RULES_PATH, "utf8"), host: "localhost", port: Number(process.env.FIRESTORE_EMULATOR_TEST_PORT ?? 8080) } });
});
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("papers").doc("p1").set({ id: "p1", tenantId: FIRST_TENANT_ID, vehicleId: VEH, customerId: "cust-1", kind: "RC", status: "VERIFIED" });
    await db.collection("papers").doc("p2").set({ id: "p2", tenantId: OTHER, vehicleId: VEH, customerId: "cust-x", kind: "RC", status: "VERIFIED" });
    await db.collection("vehicles").doc(VEH).collection("protections").doc("pr1").set({ id: "pr1", tenantId: FIRST_TENANT_ID, vehicleId: VEH, customerId: "cust-1", kind: "INSURANCE" });
  });
});
const as = (role: string, tenantId = FIRST_TENANT_ID, uid = `uid-${role}`) => testEnv.authenticatedContext(uid, { role, tenantId, studioId: null });
const papers = (c: ReturnType<typeof as>, tenant?: string) => {
  const base = c.firestore().collection("papers");
  return (tenant ? base.where("tenantId", "==", tenant) : base).where("vehicleId", "==", VEH).get();
};
const prots = (c: ReturnType<typeof as>, tenant?: string) => {
  const base = c.firestore().collection("vehicles").doc(VEH).collection("protections");
  return (tenant ? base.where("tenantId", "==", tenant) : base).get();
};

describe("admin Cars lookup: papers list query", () => {
  it("admin with tenant-filtered query succeeds and sees only own-tenant papers", async () => {
    const snap = await assertSucceeds(papers(as("admin"), FIRST_TENANT_ID));
    if (snap.size !== 1 || snap.docs[0]!.id !== "p1") throw new Error(`expected only p1, got ${snap.docs.map((d) => d.id).join(",")}`);
  });
  it("vehicleId-only query (the old getVehiclePapers) is denied", async () => { await assertFails(papers(as("admin"))); });
  it("cross-tenant filter is denied", async () => { await assertFails(papers(as("admin"), OTHER)); });
  it("admin of another tenant cannot read this tenant's papers", async () => { await assertFails(papers(as("admin", OTHER), FIRST_TENANT_ID)); });
});
describe("admin Cars lookup: protections list query", () => {
  it("admin with tenant-filtered query succeeds", async () => {
    const snap = await assertSucceeds(prots(as("admin"), FIRST_TENANT_ID));
    if (snap.size !== 1) throw new Error(`expected 1 protection, got ${snap.size}`);
  });
  it("unfiltered list (the old getVehicleProtections) is denied", async () => { await assertFails(prots(as("admin"))); });
  it("cross-tenant filter is denied", async () => { await assertFails(prots(as("admin"), OTHER)); });
  it("a customer cannot run the staff protections query", async () => { await assertFails(prots(as("customer", FIRST_TENANT_ID, "cust-2"), FIRST_TENANT_ID)); });
});
