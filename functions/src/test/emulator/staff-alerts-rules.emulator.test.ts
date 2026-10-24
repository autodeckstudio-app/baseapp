/** Intended scope: studio role reads its own studio only, admin its tenant, superadmin all. /staffAlerts rules: staff-only read (studio own studio, admin tenant-wide), never customers, other tenants, other studios; no client writes. */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FIRST_TENANT_ID } from "@autodeck/core";

const RULES_PATH = resolve(__dirname, "../../../../firestore.rules");
const STUDIO = "studio-ahmedabad";
let testEnv: RulesTestEnvironment;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: "autodeck-dev", firestore: { rules: readFileSync(RULES_PATH, "utf8"), host: "localhost", port: Number(process.env.FIRESTORE_EMULATOR_TEST_PORT ?? 8080) } });
});
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("staffAlerts").doc("a1").set({ id: "a1", tenantId: FIRST_TENANT_ID, studioId: STUDIO, kind: "ambiguous_payment_link", paymentId: "p1", createdAt: "2026-10-24T00:00:00Z" });
  });
});
const ctx = (role: string, o: { tenantId?: string; studioId?: string | null } = {}) =>
  testEnv.authenticatedContext(`uid-${role}`, { role, tenantId: o.tenantId ?? FIRST_TENANT_ID, studioId: o.studioId === undefined ? (role === "studio" ? STUDIO : null) : o.studioId });
const get = (c: ReturnType<typeof ctx>) => c.firestore().collection("staffAlerts").doc("a1").get();

describe("/staffAlerts", () => {
  it("own-studio staff can read", async () => { await assertSucceeds(get(ctx("studio"))); });
  it("superadmin can read", async () => { await assertSucceeds(get(ctx("superadmin"))); });
  it("admin of the tenant can read", async () => { await assertSucceeds(get(ctx("admin"))); });
  it("studio staff of another studio cannot read", async () => { await assertFails(get(ctx("studio", { studioId: "studio-other" }))); });
  it("staff of another tenant cannot read", async () => {
    await assertFails(get(ctx("studio", { tenantId: "tenant-other" })));
    await assertFails(get(ctx("admin", { tenantId: "tenant-other" })));
  });
  it("customers cannot read", async () => { await assertFails(get(ctx("customer"))); });
  it("unauthenticated cannot read", async () => { await assertFails(testEnv.unauthenticatedContext().firestore().collection("staffAlerts").doc("a1").get()); });
  it("studio list query must be studio-scoped; unscoped tenant query is denied", async () => {
    const s = ctx("studio").firestore().collection("staffAlerts");
    await assertSucceeds(s.where("tenantId", "==", FIRST_TENANT_ID).where("studioId", "==", STUDIO).get());
    await assertFails(s.where("tenantId", "==", FIRST_TENANT_ID).get());
  });
  it("no client writes by anyone", async () => {
    for (const role of ["studio", "admin", "superadmin", "customer"]) {
      const d = ctx(role).firestore().collection("staffAlerts").doc("x");
      await assertFails(d.set({ tenantId: FIRST_TENANT_ID, studioId: STUDIO }));
      await assertFails(ctx(role).firestore().collection("staffAlerts").doc("a1").delete());
    }
  });
});
