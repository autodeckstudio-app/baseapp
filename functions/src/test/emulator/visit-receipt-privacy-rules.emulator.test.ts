/** Real Firestore rules: visit money and terminal attempt facts are callable-only. Fixture data only. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TEST_PROJECT_ID } from "../emulator-setup";

const COLLECTIONS = ["visitReceiptAttempts", "visitReceipts", "visitInvoices", "visitProviderAttempts", "visitProviderHeads", "visitProviderEvents", "visitProviderCaptures", "visitOnlineReceipts", "visitOnlineApplications", "visitProviderIngressReviews", "visitServiceReturnPlans"] as const;
const fixture = { id: "private-fact", tenantId: "visit-money-tenant", studioId: "studio-one", customerId: "customer-one", visitId: "visit-one", state: "rejected", reason: "bill_changed", receivedPaise: 72000 };
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: TEST_PROJECT_ID, firestore: {
    rules: readFileSync(resolve(__dirname, "../../../../firestore.rules"), "utf8"),
    host: "localhost", port: Number(process.env["FIRESTORE_EMULATOR_TEST_PORT"] ?? 8099),
  } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const collection of COLLECTIONS) await db.doc(`${collection}/private-fact`).set(fixture);
    await db.doc("customers/customer-one").set({ id: "customer-one", authUid: "customer-one", tenantId: fixture.tenantId, deletedAt: null });
  });
});
afterAll(async () => { await env.cleanup(); });

const actors = [
  { name: "own customer", uid: "customer-one", role: "customer", tenantId: fixture.tenantId, studioId: null },
  { name: "studio", uid: "studio-one", role: "studio", tenantId: fixture.tenantId, studioId: fixture.studioId },
  { name: "admin", uid: "admin-one", role: "admin", tenantId: fixture.tenantId, studioId: null },
  { name: "superadmin", uid: "superadmin-one", role: "superadmin", tenantId: fixture.tenantId, studioId: null },
  { name: "accountant", uid: "accountant-one", role: "accountant", tenantId: fixture.tenantId, studioId: null },
  { name: "other tenant admin", uid: "admin-other", role: "admin", tenantId: "other-tenant", studioId: null },
  { name: "anonymous", uid: null, role: null, tenantId: null, studioId: null },
];

describe("visit money facts and terminal receipt rejection are server-only", () => {
  for (const collection of COLLECTIONS) for (const actor of actors) {
    it(`${actor.name}: no get, list, create, overwrite, update or delete on ${collection}`, async () => {
      const context = actor.uid ? env.authenticatedContext(actor.uid, { role: actor.role, tenantId: actor.tenantId, studioId: actor.studioId }) : env.unauthenticatedContext();
      const db = context.firestore();
      const original = db.doc(`${collection}/private-fact`);
      await assertFails(original.get());
      await assertFails(db.collection(collection).where("tenantId", "==", fixture.tenantId).get());
      await assertFails(db.doc(`${collection}/forged-${actor.role ?? "anonymous"}`).set(fixture));
      await assertFails(original.set({ ...fixture, state: "recorded", receivedPaise: 0 }));
      await assertFails(original.update({ state: "recorded", reason: "", receivedPaise: 0 }));
      await assertFails(original.delete());
    });
  }
  it("denied writes leave all original facts unchanged and create no extra facts", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      for (const collection of COLLECTIONS) {
        const result = await db.collection(collection).get();
        expect(result.size).toBe(1);
        expect(result.docs[0]!.data()).toEqual(fixture);
      }
    });
  });
});
