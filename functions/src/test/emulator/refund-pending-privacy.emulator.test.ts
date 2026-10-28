/**
 * SUPERSESSION NOTE (28 Oct review): the "pending_correlation" mechanism (pending replay record + staff alert refund_event_pending +
 * bounded re-drive, commits 94de99ca / 348f5145) no longer exists in functions/src: an event that binds completely to our request is
 * "outbox_owned" and its evidence is adopted and projected at once (5205613d, fa9777e9, 9db23be5; razorpay-webhook.ts owned-processed
 * drain). The three original tests asserted that removed mechanism and are replaced below by what still applies: (1) the stored event
 * record for an owned refund event leaks no contact/notes/URLs/link/order/reference, (2) the real rules read denials for the
 * staff-visible alert and the server-only event record (docs seeded directly in the same shapes), and the bounded re-drive test is
 * retired with the feature. Original text follows.
 * TEST. Pending refund events: (1) what is stored where (allowlist; no contact/email/notes/URLs/links/order ids), (2) real rules read denials
 * for customer / accountant / other studio / other tenant on the staff-visible alert and the server-only pending record, (3) bounded re-drive
 * with a truncation signal when more than MAX_REDRIVE are waiting. Fixtures are local; docs produced by the real handler.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { reserveRefund, runRefundOutbox } from "../../lib/refund-outbox.js";

const db = getFirestore();
const provider = new RazorpayProvider("rzp_test_x", "secret", "whsec_test");
const T = "pv-tenant";
const SECRET_BITS = ["secret@example.com", "+919000090000", "SECRETNOTE", "https://secret.example/x", "plink_SECRET", "order_SECRET", "ref_SECRET"];
let testEnv: RulesTestEnvironment;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: "autodeck-dev", firestore: { rules: readFileSync(resolve(__dirname, "../../../../firestore.rules"), "utf8"), host: "localhost", port: Number(process.env.FIRESTORE_EMULATOR_TEST_PORT ?? 8080) } });
});
afterAll(async () => { await testEnv.cleanup(); });

let n = 0;
async function pending(studioId: string | null = "studio-a") {
  n += 1; const id = `${Date.now()}${n}`, pid = `pvpay${id}`, bid = `pvb${id}`, pay = `pay_pv${id}`, rid = `rfnd_pv${id}`;
  const p = { id: pid, tenantId: T, studioId, targetType: "booking", jobId: null, bookingId: bid, customerId: "c", amount: 50000, currency: "INR",
    status: "completed", razorpayPaymentId: pay, razorpayRefundId: null, refundAmount: null } as never;
  await db.collection("payments").doc(pid).set(p as object);
  await db.collection("bookings").doc(bid).set({ id: bid, tenantId: T, paymentStatus: "paid" });
  const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "a1" });
  const mk = (event: string, eid: string) => {
    const e = provider.parseWebhookEvent(JSON.stringify({ event, payload: {
      refund: { entity: { id: rid, payment_id: pay, amount: 50000, currency: "INR", status: "processed", receipt: requestId, notes: { comment: "SECRETNOTE" } } },
      payment: { entity: { id: pay, amount: 50000, currency: "INR", email: "secret@example.com", contact: "+919000090000", notes: ["SECRETNOTE"], description: "https://secret.example/x", order_id: "order_SECRET" } },
      payment_link: { entity: { id: "plink_SECRET", reference_id: "ref_SECRET" } } } }));
    e.providerEventId = eid; return e;
  };
  return { pid, bid, rid, mk };
}

describe("owned refund event storage", () => {
  it("the stored event record for an owned processed refund leaks no contact/notes/URLs/link/order/reference", async () => {
    const s = await pending(); const e = s.mk("refund.processed", "PV1" + s.pid);
    expect((await processProviderEvent(db, e)).outcome).toBe("outbox_owned");
    const rec = (await db.collection("paymentEvents").doc(e.providerEventId).get()).data()!;
    expect(rec).toBeTruthy();
    const all = JSON.stringify([rec, (await db.collection("staffAlerts").where("paymentId", "==", s.pid).get()).docs.map((d) => d.data())]);
    for (const bit of SECRET_BITS) expect(all).not.toContain(bit);
  });
});

describe("real rules: read denial on the alert and the server-only event record", () => {
  it("only admin / superadmin / own-studio staff read the alert; nobody reads the server-only record", async () => {
    n += 1; const key = `${Date.now()}${n}`;
    const aId = `refund_event_pending_PV2${key}`, sId = `pending_PV2${key}`;
    const a = { id: aId, kind: "refund_event_pending", tenantId: T, studioId: "studio-a", paymentId: `pvpay${key}`, createdAt: new Date().toISOString() };
    const sv = { kind: "pending_refund_event", tenantId: T, paymentId: `pvpay${key}`, providerRefundId: `rfnd_pv${key}`, createdAt: new Date().toISOString(), event: { providerEventId: `PV2${key}` } };
    await testEnv.withSecurityRulesDisabled(async (c) => { const f = c.firestore(); await f.collection("staffAlerts").doc(aId).set(a); await f.collection("paymentEvents").doc(sId).set(sv); });
    const as = (role: string, tenantId = T, studioId: string | null = null) => testEnv.authenticatedContext(`u-${role}`, { role, tenantId, studioId });
    const alert = (c: ReturnType<typeof as>) => c.firestore().collection("staffAlerts").doc(aId).get();
    const server = (c: ReturnType<typeof as>) => c.firestore().collection("paymentEvents").doc(sId).get();
    await assertSucceeds(alert(as("admin"))); await assertSucceeds(alert(as("superadmin"))); await assertSucceeds(alert(as("studio", T, "studio-a")));
    await assertFails(alert(as("studio", T, "studio-b")));
    await assertFails(alert(as("customer"))); await assertFails(alert(as("accountant")));
    await assertFails(alert(as("admin", "other-tenant")));
    await assertFails(alert(testEnv.unauthenticatedContext()));
    for (const role of ["admin", "superadmin", "studio", "customer", "accountant"]) await assertFails(server(as(role, T, role === "studio" ? "studio-a" : null)));
    await assertFails(testEnv.authenticatedContext("u-admin", { role: "admin", tenantId: T, studioId: null }).firestore().collection("paymentEvents").doc("x").set({ a: 1 }));
  });
});
