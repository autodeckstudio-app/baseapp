/** TEST. Raw-document default-deny for the "accountant" role (rules emulator, fixture docs, no real account). */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FIRST_TENANT_ID } from "@autodeck/core";

const RULES_PATH = resolve(__dirname, "../../../../firestore.rules");
const PRIVATE = ["payments", "invoices", "expenses", "dailyClosings", "customers", "bookings", "jobs", "vehicles", "memberships", "staffAlerts", "refundRequests",
  "paymentEvents", "auditLogs", "gifts", "warranties", "attendance", "staff", "users", "notifications", "inspections"];
let testEnv: RulesTestEnvironment;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: "autodeck-dev", firestore: { rules: readFileSync(RULES_PATH, "utf8"), host: "localhost", port: Number(process.env["FIRESTORE_EMULATOR_TEST_PORT"] ?? 8080) } });
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const f0 = ctx.firestore();
    for (const c of PRIVATE) await f0.collection(c).doc("d1").set({ id: "d1", tenantId: FIRST_TENANT_ID, studioId: "s1", customerId: "someone", ownerId: "someone" });
  });
});
afterAll(async () => { await testEnv.cleanup(); });

describe("accountant raw access", () => {
  const acc = () => testEnv.authenticatedContext("uid-acc", { role: "accountant", tenantId: FIRST_TENANT_ID, studioId: null });
  for (const c of PRIVATE) {
    it(`cannot read or write /${c}`, async () => {
      const f = acc().firestore();
      await assertFails(f.collection(c).doc("d1").get());
      await assertFails(f.collection(c).where("tenantId", "==", FIRST_TENANT_ID).get());
      await assertFails(f.collection(c).doc("new").set({ tenantId: FIRST_TENANT_ID }));
      await assertFails(f.collection(c).doc("d1").delete());
    });
  }
});
