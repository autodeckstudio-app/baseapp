/**
 * TEST. Dedicated read-only "accountant" role: getAccountantMoney projection (real Firestore emulator, seeded FIXTURE
 * data only; no real user, claim or account). Proves the finite allowlist (poisoned source fields never appear),
 * the role matrix, tenant isolation, truncation signalling and that no aggregate is returned when truncated.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { getAccountantMoney, ACCOUNTANT_CAP } from "../../functions/office/getAccountantMoney.js";

const db = getFirestore();
const T = "acct-tenant", OTHER = "acct-tenant-2", S = "acct-studio", MONTH = "2026-10";
const auth = (role: string, tenantId = T) => ({ uid: `u-${role}`, token: { role, tenantId, studioId: role === "studio" ? S : null }, rawToken: "x" });
const call = (a: ReturnType<typeof auth> | undefined, data: unknown = { studioId: S, month: MONTH }) =>
  (getAccountantMoney as unknown as { run: (r: unknown) => Promise<Record<string, unknown>> }).run({ auth: a, data });

const POISON = ["publicToken-SECRET", "https://pdf.example/SECRET.pdf", "GJ01AB1234", "voided-free-text", "Vendor-Name-SECRET", "note-SECRET", "manual-ref-SECRET", "pay_provider_SECRET", "uid-staff-SECRET", "Premium Wash SECRET desc", "cust-id-SECRET"];

beforeAll(async () => {
  await db.collection("studioConfig").doc(S).set({ tenantId: T });
  await db.collection("payments").doc("acp1").set({ id: "acp1", tenantId: T, studioId: S, amount: 10000, currency: "INR", method: "cash", status: "completed",
    completedAt: "2026-10-10T06:00:00.000Z", createdAt: "2026-10-10T05:00:00.000Z", refundAmount: null, invoiceId: "aci1",
    customerId: "cust-id-SECRET", manualReference: "manual-ref-SECRET", recordedBy: "uid-staff-SECRET", razorpayPaymentId: "pay_provider_SECRET", futureField: "future-SECRET" });
  await db.collection("invoices").doc("aci1").set({ id: "aci1", tenantId: T, studioId: S, status: "issued", invoiceNumber: "INV-2026-00001", issuedAt: "2026-10-10T06:00:00.000Z",
    createdAt: "2026-10-10T06:00:00.000Z", voidedAt: null, voidedReason: "voided-free-text", publicToken: "publicToken-SECRET", pdfUrl: "https://pdf.example/SECRET.pdf",
    vehicleSnapshot: { registrationNumber: "GJ01AB1234" }, customerSnapshot: { name: "Asha" }, customerId: "cust-id-SECRET",
    lineItems: [{ description: "Premium Wash SECRET desc", serviceName: "Premium Wash SECRET desc", quantity: 1, unitPrice: 8475, total: 8475 }],
    subtotal: 8475, discount: 0, discountDescription: null, taxRatePercent: 18, taxDescription: "GST 18%", tax: 1525, total: 10000, currency: "INR" });
  await db.collection("expenses").doc("ace1").set({ id: "ace1", tenantId: T, studioId: S, amount: 500, category: "SUPPLIES", paidVia: "CASH", vendor: "Vendor-Name-SECRET", notes: "note-SECRET",
    createdBy: "uid-staff-SECRET", date: "2026-10-11", month: MONTH });
  await db.collection("dailyClosings").doc(`${T}__${S}__2026-10-10`).set({ id: `${T}__${S}__2026-10-10`, tenantId: T, studioId: S, date: "2026-10-10", status: "CLOSED",
    expectedCashPaise: 9500, upiPaise: 0, cardPaise: 0, bankTransferPaise: 0, totalRevenuePaise: 10000, expensesPaise: 500, paymentCount: 1, expenseCount: 1,
    countedCashPaise: 9500, variancePaise: 0, notes: "note-SECRET", closedBy: "uid-staff-SECRET", closedAt: "2026-10-10T15:00:00.000Z", closeCount: 1 });
});

describe("getAccountantMoney", () => {
  it("returns only allowlisted fields: no poisoned source value appears anywhere in the output", async () => {
    const out = await call(auth("accountant"));
    const text = JSON.stringify(out);
    for (const p of POISON) expect(text, p).not.toContain(p);
    expect(text).not.toContain("future-SECRET");
    expect((out["payments"] as unknown[])).toHaveLength(1);
    expect((out["invoices"] as Array<Record<string, unknown>>)[0]).toEqual({ id: "aci1", invoiceNumber: "INV-2026-00001", status: "issued", issuedAt: "2026-10-10T06:00:00.000Z",
      voidedAt: null, customerName: "Asha", lineItems: [{ quantity: 1, unitPrice: 8475, total: 8475 }], subtotal: 8475, discount: 0, taxRatePercent: 18, tax: 1525, total: 10000, currency: "INR" });
    expect(Object.keys((out["payments"] as Array<Record<string, unknown>>)[0]!).sort()).toEqual(["amount", "completedAt", "createdAt", "currency", "id", "invoiceId", "method", "refundAmount", "status"]);
    expect(Object.keys((out["expenses"] as Array<Record<string, unknown>>)[0]!).sort()).toEqual(["amount", "category", "date", "id", "month", "paidVia"]);
    expect(Object.keys((out["dayCloses"] as Array<Record<string, unknown>>)[0]!)).not.toContain("notes");
    expect(out["report"]).toMatchObject({ totalReceiptsPaise: 10000, cashPaise: 10000, expensesPaise: 500, paymentCount: 1 });
    expect(out["truncated"]).toEqual({ payments: false, expenses: false, invoices: false });
  });
  it("role matrix: only accountant; customer, studio, admin, superadmin, unauthenticated are denied", async () => {
    for (const r of ["customer", "studio", "admin", "superadmin"]) await expect(call(auth(r)), r).rejects.toThrow(/not authorized/);
    await expect(call(undefined)).rejects.toThrow(/Authentication required/);
  });
  it("tenant isolation: an accountant of another tenant cannot read this studio", async () => {
    await expect(call(auth("accountant", OTHER))).rejects.toThrow(/Studio not found/);
  });
  it("strict input: unknown keys and a bad month are rejected", async () => {
    await expect(call(auth("accountant"), { studioId: S, month: MONTH, extra: 1 })).rejects.toBeTruthy();
    await expect(call(auth("accountant"), { studioId: S, month: "Oct" })).rejects.toBeTruthy();
  });
  it("over the cap: truncation is signalled and NO aggregate is returned", async () => {
    const T2 = "acct-big", S2 = "acct-big-studio";
    await db.collection("studioConfig").doc(S2).set({ tenantId: T2 });
    for (let b = 0; b < Math.ceil((ACCOUNTANT_CAP + 1) / 400); b++) {
      const batch = db.batch();
      for (let i = b * 400; i < Math.min((b + 1) * 400, ACCOUNTANT_CAP + 1); i++) {
        batch.set(db.collection("payments").doc(`big${i}`), { id: `big${i}`, tenantId: T2, studioId: S2, amount: 100, currency: "INR", method: "cash", status: "completed",
          completedAt: new Date(Date.parse("2026-10-20T00:00:00Z") + i * 1000).toISOString(), createdAt: "2026-10-20T00:00:00.000Z", refundAmount: null, invoiceId: null });
      }
      await batch.commit();
    }
    const out = await call(auth("accountant", T2), { studioId: S2, month: MONTH });
    expect((out["truncated"] as Record<string, boolean>)["payments"]).toBe(true);
    expect(out["report"]).toBeNull();
    expect((out["payments"] as unknown[]).length).toBeLessThanOrEqual(ACCOUNTANT_CAP);
  });
});
