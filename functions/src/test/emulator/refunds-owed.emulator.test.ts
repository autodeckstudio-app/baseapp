/**
 * TEST. Refunds owed (manual, not yet returned) aggregate on every money surface: dayAggregates (Daily Close + dashboard), getOfficeReport
 * and the accountant projection. Real Firestore emulator, fixtures only. The owed total is a separate figure: it must never change revenue,
 * expected cash, net or accountant receipts, and must be scoped to tenant + studio.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { refundsOwed, REFUNDS_OWED_CAP } from "../../lib/refunds-owed.js";
import { dayAggregates } from "../../lib/dayAggregates.js";
import { getOfficeReport } from "../../functions/office/getOfficeReport.js";
import { getAccountantMoney } from "../../functions/office/getAccountantMoney.js";

const db = getFirestore();
const T = "ro-tenant", T2 = "ro-tenant-2", S = "ro-studio", S2 = "ro-studio-2";
const run = (fn: unknown, auth: unknown, data: unknown) => (fn as { run: (r: unknown) => Promise<Record<string, unknown>> }).run({ auth, data });

beforeAll(async () => {
  await db.collection("studioConfig").doc(S).set({ tenantId: T });
  await db.collection("payments").doc("rop1").set({ id: "rop1", tenantId: T, studioId: S, amount: 20000, currency: "INR", method: "cash", status: "completed",
    completedAt: "2026-10-10T06:00:00.000Z", createdAt: "2026-10-10T05:00:00.000Z" });
  const b = (id: string, o: Record<string, unknown>) => db.collection("bookings").doc(id).set({ id, tenantId: T, studioId: S, status: "CANCELLED", ...o });
  await b("rob1", { manualRefundDuePaise: 15000 });
  await b("rob2", { manualRefundDuePaise: 5000 });
  await b("rob3", {}); // cancelled, nothing owed
  await b("rob4", { manualRefundDuePaise: 0 });
  await b("rob5", { status: "CONFIRMED", manualRefundDuePaise: 99999 }); // not cancelled: ignored
  await b("rob6", { studioId: S2, manualRefundDuePaise: 7777 });
  await b("rob7", { tenantId: T2, manualRefundDuePaise: 8888 });
});

describe("refunds owed aggregate", () => {
  it("dayAggregates: owed total/count for this tenant+studio only; revenue and expected cash unchanged", async () => {
    const a = await dayAggregates(T, S, "2026-10-10");
    expect(a).toMatchObject({ refundsOwedPaise: 20000, refundsOwedCount: 2, refundsOwedTruncated: false, totalRevenuePaise: 20000, cashPaise: 20000, expectedCashPaise: 20000, paymentCount: 1 });
    const other = await dayAggregates(T, S2, "2026-10-10");
    expect(other).toMatchObject({ refundsOwedPaise: 7777, refundsOwedCount: 1, totalRevenuePaise: 0 });
    expect(await dayAggregates(T2, S, "2026-10-10")).toMatchObject({ refundsOwedPaise: 8888, refundsOwedCount: 1, totalRevenuePaise: 0 }); // its own tenant only
  });
  it("office report: owed shown beside, net = revenue - expenses untouched", async () => {
    const r = await run(getOfficeReport, { uid: "u", token: { role: "admin", tenantId: T, studioId: null }, rawToken: "x" }, { studioId: S, month: "2026-10" });
    expect(r).toMatchObject({ refundsOwedPaise: 20000, refundsOwedCount: 2, refundsOwedTruncated: false, totalRevenuePaise: 20000, netPaise: 20000 });
  });
  it("accountant projection: separate refundsOwed block and an honest note; receipts not netted", async () => {
    const r = await run(getAccountantMoney, { uid: "u", token: { role: "accountant", tenantId: T, studioId: null }, rawToken: "x" }, { studioId: S, month: "2026-10" });
    expect(r["refundsOwed"]).toEqual({ paise: 20000, count: 2, truncated: false });
    expect(r["report"]).toMatchObject({ totalReceiptsPaise: 20000 });
    expect(JSON.stringify(r["notes"])).toContain("Refunds owed to customers are shown separately");
    expect(JSON.stringify(r)).not.toContain("rob1"); // no booking ids or customer data leave through this block
  });
  it("invalid owed amounts never silently understate: valid ones still counted, result flagged incomplete", async () => {
    for (const [i, bad] of [[1, Number.NaN], [2, -500], [3, 12.5], [4, "15000"]] as const) {
      await db.collection("bookings").doc(`bad${i}`).set({ id: `bad${i}`, tenantId: "ro-t3", studioId: S, status: "CANCELLED", manualRefundDuePaise: bad });
    }
    await db.collection("bookings").doc("good1").set({ id: "good1", tenantId: "ro-t3", studioId: S, status: "CANCELLED", manualRefundDuePaise: 3000 });
    expect(await refundsOwed(db, "ro-t3", S)).toEqual({ owedPaise: 3000, count: 1, truncated: true });
  });
  it("past the cap the result says truncated (total is a floor); at the cap it does not", async () => {
    const mk = async (tenant: string, n: number) => {
      for (let off = 0; off < n; off += 400) {
        const bt = db.batch();
        for (let i = off; i < Math.min(n, off + 400); i++) bt.set(db.collection("bookings").doc(`${tenant}-${i}`), { id: `${tenant}-${i}`, tenantId: tenant, studioId: S, status: "CANCELLED", manualRefundDuePaise: 100 });
        await bt.commit();
      }
    };
    await mk("ro-cap-eq", REFUNDS_OWED_CAP);
    expect(await refundsOwed(db, "ro-cap-eq", S)).toEqual({ owedPaise: 100 * REFUNDS_OWED_CAP, count: REFUNDS_OWED_CAP, truncated: false });
    await mk("ro-cap-over", REFUNDS_OWED_CAP + 1);
    expect(await refundsOwed(db, "ro-cap-over", S)).toEqual({ owedPaise: 100 * REFUNDS_OWED_CAP, count: REFUNDS_OWED_CAP, truncated: true });
  }, 60000);
});
