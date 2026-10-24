/**
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

describe("pending refund event storage", () => {
  it("staff alert holds only kind/ids; the server-only record holds only allowlisted replay facts; no contact/notes/URLs/link/order/reference leak", async () => {
    const s = await pending(); const e = s.mk("refund.processed", "PV1" + s.pid);
    expect((await processProviderEvent(db, e)).outcome).toBe("pending_correlation");
    const alert = (await db.collection("staffAlerts").doc(`refund_event_pending_${e.providerEventId}`).get()).data()!;
    const server = (await db.collection("paymentEvents").doc(`pending_${e.providerEventId}`).get()).data()!;
    expect(Object.keys(alert).sort()).toEqual(["createdAt", "id", "kind", "paymentId", "studioId", "tenantId"]);
    expect(Object.keys(server).sort()).toEqual(["createdAt", "event", "kind", "paymentId", "providerRefundId", "tenantId"]);
    expect(Object.keys(server["event"]).sort()).toEqual(["currency", "eventType", "providerEventId", "providerPaymentEntityCurrency", "providerPaymentEntityId", "providerPaymentId",
      "providerRefundAmount", "providerRefundCurrency", "providerRefundId", "providerRefundPaymentId", "providerRefundReceipt", "providerRefundStatus"]);
    const all = JSON.stringify([alert, server]);
    for (const bit of SECRET_BITS) expect(all).not.toContain(bit);
  });
});

describe("real rules: read denial on the pending records", () => {
  it("only admin / superadmin / own-studio staff read the alert; nobody reads the server-only record", async () => {
    const s = await pending("studio-a"); const e = s.mk("refund.processed", "PV2" + s.pid);
    await processProviderEvent(db, e);
    const aId = `refund_event_pending_${e.providerEventId}`, sId = `pending_${e.providerEventId}`;
    const a = (await db.collection("staffAlerts").doc(aId).get()).data()!; const sv = (await db.collection("paymentEvents").doc(sId).get()).data()!;
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

describe("bounded re-drive", () => {
  it("more than 10 pending: first 10 processed, truncation alert raised, the rest stay pending and finish on the next later event", async () => {
    const s = await pending();
    const base = s.mk("refund.processed", "PVT0" + s.pid);
    const pend = Array.from({ length: 12 }, (_, i) => s.mk("refund.processed", `PVT${i}` + s.pid));
    expect((await processProviderEvent(db, pend[0]!)).outcome).toBe("pending_correlation");
    for (const e of pend.slice(1)) await processProviderEvent(db, e);
    void base;
    await runRefundOutbox(db, { initiateRefund: async () => ({ providerRefundId: s.rid }) } as never);
    const pendingLeft = async () => (await db.collection("paymentEvents").where("kind", "==", "refund_event_pending").where("paymentId", "==", s.pid).get()).size;
    expect(await pendingLeft()).toBe(12);
    await processProviderEvent(db, s.mk("refund.created", "PVL1" + s.pid));
    const outcomes = await Promise.all(pend.map(async (e) => (await db.collection("paymentEvents").doc(e.providerEventId).get()).data()?.["outcome"] as string | undefined));
    expect(outcomes.filter((o) => o === "refund_processed")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "already_final")).toHaveLength(9);
    expect(outcomes.filter((o) => o === undefined)).toHaveLength(2);
    expect(await pendingLeft()).toBe(2);
    expect((await db.collection("staffAlerts").doc(`refund_pending_truncated_${s.pid}`).get()).exists).toBe(true);
    await processProviderEvent(db, s.mk("refund.created", "PVL2" + s.pid));
    expect(await pendingLeft()).toBe(0);
    expect((await db.collection("staffAlerts").doc(`refund_pending_truncated_${s.pid}`).get()).exists).toBe(false);
    expect((await db.collection("bookings").doc(s.bid).get()).data()!["refundStatus"]).toBe("processed");
  });
});
