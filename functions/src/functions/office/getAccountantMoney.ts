import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Expense, Invoice, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractAccountantUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getAccountantMoneySchema } from "../../schemas/office.js";
import { utcToLocalDate } from "../../lib/schedule.js";
import { refundsOwed } from "../../lib/refunds-owed.js";

// READ-ONLY monthly Money projection for the dedicated "accountant" role. The role has NO Firestore rule access
// to any collection; everything it can see is built here from an explicit, finite field allowlist. Unknown
// future fields on a source doc are never passed through. Excluded on purpose: invoice publicToken, pdfUrl,
// vehicleSnapshot, voidedReason, line-item descriptions (free text), payment customerId/manualReference/recordedBy,
// provider ids, expense vendor/notes/createdBy, day-close notes/closedBy. No write path.
export const ACCOUNTANT_CAP = 2000;

export function projectInvoice(i: Invoice) {
  return {
    ...(i.settlementKind === "membership_covered" ? {settlementKind:"membership_covered" as const} : {}),
    id: i.id, invoiceNumber: i.invoiceNumber, status: i.status, issuedAt: i.issuedAt, voidedAt: i.voidedAt,
    customerName: i.customerSnapshot?.name ?? null,
    lineItems: (i.lineItems ?? []).map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, total: l.total })),
    subtotal: i.subtotal, discount: i.discount, taxRatePercent: i.taxRatePercent, tax: i.tax, total: i.total, currency: i.currency,
  };
}
export function projectPayment(p: Payment) {
  return {
    id: p.id, amount: p.amount, currency: p.currency, method: p.method, status: p.status,
    completedAt: p.completedAt ?? null, createdAt: p.createdAt, refundAmount: p.refundAmount ?? null, invoiceId: p.invoiceId ?? null,
  };
}
export function projectExpense(e: Expense) {
  return { id: e.id, amount: e.amount, category: e.category, paidVia: e.paidVia, date: e.date, month: e.month };
}
const DAYCLOSE_KEYS = ["id", "date", "status", "expectedCashPaise", "upiPaise", "cardPaise", "bankTransferPaise", "totalRevenuePaise",
  "expensesPaise", "paymentCount", "expenseCount", "countedCashPaise", "variancePaise", "closeCount", "closedAt"] as const;
export function projectDayClose(d: Record<string, unknown>) {
  const o: Record<string, unknown> = {};
  for (const k of DAYCLOSE_KEYS) o[k] = d[k] ?? null;
  return o;
}

function daysOf(month: string): string[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, k) => `${month}-${String(k + 1).padStart(2, "0")}`);
}

export const getAccountantMoney = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractAccountantUser(request);
  const data = validate(getAccountantMoneySchema, request.data);
  await enforceRateLimit(subjectFrom(user), "office.accountantMoney");
  const db = getFirestore();
  const tenantId = user.claims.tenantId;

  const studio = await db.collection(COLLECTIONS.studioConfig()).doc(data.studioId).get();
  if (!studio.exists || (studio.data() as { tenantId?: string }).tenantId !== tenantId) {
    throw new HttpsError("permission-denied", "Studio not found for this account.");
  }

  const owed = await refundsOwed(db, tenantId, data.studioId);
  const monthStart = `${data.month}-01`;
  const [paySnap, expSnap, issuedSnap, voidSnap, closeSnaps] = await Promise.all([
    db.collection(COLLECTIONS.payments()).where("tenantId", "==", tenantId).where("studioId", "==", data.studioId)
      .where("status", "==", "completed").orderBy("completedAt", "desc").limit(ACCOUNTANT_CAP + 1).get(),
    db.collection(COLLECTIONS.expenses()).where("tenantId", "==", tenantId).where("studioId", "==", data.studioId)
      .where("month", "==", data.month).orderBy("date", "desc").limit(ACCOUNTANT_CAP + 1).get(),
    db.collection(COLLECTIONS.invoices()).where("tenantId", "==", tenantId).where("studioId", "==", data.studioId)
      .where("status", "==", "issued").orderBy("createdAt", "desc").limit(ACCOUNTANT_CAP + 1).get(),
    db.collection(COLLECTIONS.invoices()).where("tenantId", "==", tenantId).where("studioId", "==", data.studioId)
      .where("status", "==", "void").orderBy("createdAt", "desc").limit(ACCOUNTANT_CAP + 1).get(),
    db.getAll(...daysOf(data.month).map((d) => db.collection(COLLECTIONS.dailyClosings()).doc(`${tenantId}__${data.studioId}__${d}`))),
  ]);

  // A source is complete when it returned no more than the cap, or when its oldest returned row is already
  // older than the month start (so nothing in the month can be missing). Otherwise it is flagged truncated.
  const complete = (n: number, oldest: string | undefined) => n <= ACCOUNTANT_CAP || (!!oldest && oldest.slice(0, 7) < data.month) || (!!oldest && oldest < monthStart);
  const payDocs = paySnap.docs.map((d) => d.data() as Payment);
  const payTrunc = !complete(payDocs.length, payDocs[payDocs.length - 1]?.completedAt ?? undefined);
  const payments = payDocs.filter((p) => p.completedAt && utcToLocalDate(new Date(p.completedAt), "Asia/Kolkata").startsWith(data.month));
  const expDocs = expSnap.docs.map((d) => d.data() as Expense);
  const expTrunc = expDocs.length > ACCOUNTANT_CAP;
  const invDocs = [...issuedSnap.docs, ...voidSnap.docs].map((d) => d.data() as Invoice);
  const invTruncIssued = !complete(issuedSnap.size, (issuedSnap.docs[issuedSnap.size - 1]?.data() as Invoice | undefined)?.createdAt);
  const invTruncVoid = !complete(voidSnap.size, (voidSnap.docs[voidSnap.size - 1]?.data() as Invoice | undefined)?.createdAt);
  const invoices = invDocs.filter((i) => (i.issuedAt ?? i.createdAt).slice(0, 7) === data.month);
  const dayCloses = closeSnaps.filter((s) => s.exists).map((s) => projectDayClose(s.data() as Record<string, unknown>));

  // Aggregates only when their inputs are complete. Never a silently partial accounting total.
  let report: Record<string, unknown> | null = null;
  if (!payTrunc && !expTrunc) {
    let total = 0, cash = 0, upi = 0, bank = 0, razorpay = 0;
    for (const p of payments) {
      total += p.amount;
      if (p.method === "cash") cash += p.amount; else if (p.method === "upi_manual") upi += p.amount;
      else if (p.method === "bank_transfer") bank += p.amount; else razorpay += p.amount;
    }
    const byCat: Record<string, number> = {};
    let exp = 0;
    for (const e of expDocs) { exp += e.amount; byCat[e.category] = (byCat[e.category] ?? 0) + e.amount; }
    report = { month: data.month, totalReceiptsPaise: total, cashPaise: cash, upiPaise: upi, bankTransferPaise: bank, razorpayPaise: razorpay,
      paymentCount: payments.length, expensesPaise: exp, expensesByCategory: byCat };
  }

  return {
    month: data.month,
    studioId: data.studioId,
    cap: ACCOUNTANT_CAP,
    truncated: { payments: payTrunc, expenses: expTrunc, invoices: invTruncIssued || invTruncVoid },
    report,
    payments: payments.slice(0, ACCOUNTANT_CAP).map(projectPayment),
    invoices: invoices.slice(0, ACCOUNTANT_CAP).map(projectInvoice),
    expenses: expDocs.slice(0, ACCOUNTANT_CAP).map(projectExpense),
    dayCloses,
    refundsOwed: { paise: owed.owedPaise, count: owed.count, truncated: owed.truncated },
    notes: ["Receipts are completed payments (cash held), not net revenue. Refunds owed to customers are shown separately (open total, not for this month) and are not netted into receipts.", "No GSTIN or HSN is stored; this is not a tax-ready export."],
  };
});
