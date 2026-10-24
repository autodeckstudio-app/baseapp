/**
 * TEST. booking.manualRefundDuePaise is SERVER ONLY: every client role is denied create / update / delete on bookings, including a write
 * that sets or edits that field, and the field survives untouched. Real firestore.rules via the rules-unit-testing harness, fixtures only.
 * Reads: a customer can read only their own booking; another customer, another tenant and an unauthenticated caller cannot.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const T = "bo-tenant", ID = "bo-booking";
let env: RulesTestEnvironment;
const FS_PORT = Number(process.env["FIRESTORE_EMULATOR_TEST_PORT"] ?? 8085);
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "autodeck-dev", firestore: { rules: readFileSync(resolve(__dirname, "../../../../firestore.rules"), "utf8"), host: "localhost", port: FS_PORT } });
  await env.withSecurityRulesDisabled(async (c) => {
    await c.firestore().doc(`bookings/${ID}`).set({ id: ID, tenantId: T, studioId: "s1", customerId: "cust1", status: "CANCELLED", manualRefundDuePaise: 10000 });
  });
});
afterAll(async () => { await env.cleanup(); });

const roles: Record<string, { uid: string; claims: Record<string, unknown> }> = {
  customer: { uid: "cust1", claims: { role: "customer", tenantId: T, studioId: null } },
  studio: { uid: "st1", claims: { role: "studio", tenantId: T, studioId: "s1" } },
  admin: { uid: "ad1", claims: { role: "admin", tenantId: T, studioId: null } },
  superadmin: { uid: "su1", claims: { role: "superadmin", tenantId: T, studioId: null } },
  accountant: { uid: "ca1", claims: { role: "accountant", tenantId: T, studioId: null } },
};

describe("manualRefundDuePaise is server only", () => {
  for (const [name, r] of Object.entries(roles)) {
    it(`${name}: cannot set/edit/clear the field, create, or delete a booking`, async () => {
      const d = env.authenticatedContext(r.uid, r.claims).firestore().doc(`bookings/${ID}`);
      await assertFails(d.update({ manualRefundDuePaise: 0 }));
      await assertFails(d.update({ manualRefundDuePaise: 999999 }));
      await assertFails(d.set({ id: ID, tenantId: T, studioId: "s1", customerId: "cust1", status: "CANCELLED", manualRefundDuePaise: 1 }));
      await assertFails(env.authenticatedContext(r.uid, r.claims).firestore().doc("bookings/new-one").set({ id: "new-one", tenantId: T, manualRefundDuePaise: 5 }));
      await assertFails(d.delete());
    });
  }
  it("field is unchanged after all denied writes", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      expect((await c.firestore().doc(`bookings/${ID}`).get()).data()).toMatchObject({ manualRefundDuePaise: 10000, status: "CANCELLED" });
    });
  });
  it("reads: own customer, studio, admin yes; other customer, other tenant, accountant, unauthenticated no", async () => {
    const rd = (ctx: ReturnType<RulesTestEnvironment["authenticatedContext"]>) => ctx.firestore().doc(`bookings/${ID}`).get();
    await assertSucceeds(rd(env.authenticatedContext("cust1", roles["customer"]!.claims)));
    await assertSucceeds(rd(env.authenticatedContext("st1", roles["studio"]!.claims)));
    await assertSucceeds(rd(env.authenticatedContext("ad1", roles["admin"]!.claims)));
    await assertFails(rd(env.authenticatedContext("cust2", { role: "customer", tenantId: T, studioId: null })));
    await assertFails(rd(env.authenticatedContext("x", { role: "admin", tenantId: "other", studioId: null })));
    await assertFails(rd(env.authenticatedContext("ca1", roles["accountant"]!.claims)));
    await assertFails(rd(env.unauthenticatedContext()));
  });
});
