import{visitReturnHash}from'../../lib/visit-service-return-state.js';
import {readVisitReturnLedger,visitReturnLedgerTotals} from '../../lib/visit-return-ledger.js';
import {readVisitOnlineLedger,visitOnlineLedgerTotals} from '../../lib/visit-online-ledger.js';
import {parseVisitInvoiceRead} from '@autodeck/core';
import {readOfflineLedger,offlineLedgerTotals} from "../../lib/offline-ledger.js";
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
import { shouldEnforceAppCheck } from "../../lib/environment.js";

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
    ...(i.roundOffPaise!==undefined?{roundOffPaise:i.roundOffPaise}:{}), subtotal: i.subtotal, discount: i.discount, taxRatePercent: i.taxRatePercent, tax: i.tax, total: i.total, currency: i.currency,
  };
}
/** Same finite accounting fields for a shared original; no component/job,
 * vehicle, provider, PDF or free-text detail crosses this projection. */
export function projectVisitInvoice(raw:unknown){
 const i=parseVisitInvoiceRead(raw),rates=[...new Set(i.components.map(c=>c.taxRatePercent))];
 return{id:i.id,invoiceNumber:i.invoiceNumber,status:'issued',issuedAt:i.issuedAt,voidedAt:null,customerName:i.customerSnapshot.name,
 lineItems:i.components.flatMap(c=>c.lineItems.map(l=>({quantity:l.quantity,unitPrice:l.unitPrice,total:l.total}))),
 subtotal:i.subtotalPaise,discount:i.discountPaise,roundOffPaise:i.roundOffPaise,taxRatePercent:rates.length===1?rates[0]!:null,tax:i.taxPaise,total:i.totalPaise,currency:'INR'};
}
export function projectPayment(p: Payment) {
  return {
    ...(p.offlineReceiptSettlement===true?{offlineReceiptSettlement:true}:{}),
    id: p.id, amount: p.amount, currency: p.currency, method: p.method, status: p.status,
    completedAt: p.completedAt ?? null, createdAt: p.createdAt, refundAmount: p.refundAmount ?? null, invoiceId: p.invoiceId ?? null,
  };
}
export function projectExpense(e: Expense) {
  return { id: e.id, amount: e.amount, category: e.category, paidVia: e.paidVia, date: e.date, month: e.month };
}
const DAYCLOSE_KEYS = ["id", "date", "status", "expectedCashPaise", "upiPaise", "cardPaise", "bankTransferPaise", "totalRevenuePaise",
  "serviceReturnsPaise", "cashServiceReturnsPaise", "onlineServiceReturnsPaise", "expensesPaise", "paymentCount", "expenseCount", "countedCashPaise", "variancePaise", "closeCount", "closedAt"] as const;
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

export const getAccountantMoney = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
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
  const [paySnap, expSnap, issuedSnap, voidSnap, visitSnap, closeSnaps] = await Promise.all([
    db.collection(COLLECTIONS.payments()).where("tenantId", "==", tenantId).where("studioId", "==", data.studioId)
      .where("status", "==", "completed").orderBy("completedAt", "desc").limit(ACCOUNTANT_CAP + 1).get(),
    db.collection(COLLECTIONS.expenses()).where("tenantId", "==", tenantId).where("studioId", "==", data.studioId)
      .where("month", "==", data.month).orderBy("date", "desc").limit(ACCOUNTANT_CAP + 1).get(),
    db.collection(COLLECTIONS.invoices()).where("tenantId", "==", tenantId).where("studioId", "==", data.studioId)
      .where("status", "==", "issued").orderBy("createdAt", "desc").limit(ACCOUNTANT_CAP + 1).get(),
    db.collection(COLLECTIONS.invoices()).where("tenantId", "==", tenantId).where("studioId", "==", data.studioId)
      .where("status", "==", "void").orderBy("createdAt", "desc").limit(ACCOUNTANT_CAP + 1).get(),
    db.collection('visitInvoices').where('tenantId','==',tenantId).where('studioId','==',data.studioId).orderBy('createdAt','desc').limit(ACCOUNTANT_CAP+1).get(),
    db.getAll(...daysOf(data.month).map((d) => db.collection(COLLECTIONS.dailyClosings()).doc(`${tenantId}__${data.studioId}__${d}`))),
  ]);

  // A source is complete when it returned no more than the cap, or when its oldest returned row is already
  // older than the month start (so nothing in the month can be missing). Otherwise it is flagged truncated.
  const complete = (n: number, oldest: string | undefined) => n <= ACCOUNTANT_CAP || (!!oldest && Number.isFinite(Date.parse(oldest)) && utcToLocalDate(new Date(oldest),'Asia/Kolkata') < monthStart);
  const payDocs = paySnap.docs.map((d) => d.data() as Payment);
  const payTrunc = !complete(payDocs.length, payDocs[payDocs.length - 1]?.completedAt ?? undefined);
  const payments = payDocs.filter((p) => p.completedAt && utcToLocalDate(new Date(p.completedAt), "Asia/Kolkata").startsWith(data.month));
  const expDocs = expSnap.docs.map((d) => d.data() as Expense);
  const expTrunc = expDocs.length > ACCOUNTANT_CAP;
  const invDocs = [...issuedSnap.docs, ...voidSnap.docs].map((d) => d.data() as Invoice);
  const invTruncIssued = !complete(issuedSnap.size, (issuedSnap.docs[issuedSnap.size - 1]?.data() as Invoice | undefined)?.createdAt);
  const invTruncVoid = !complete(voidSnap.size, (voidSnap.docs[voidSnap.size - 1]?.data() as Invoice | undefined)?.createdAt);
  const invoices = invDocs.filter((i) => utcToLocalDate(new Date(i.issuedAt ?? i.createdAt),'Asia/Kolkata').startsWith(data.month));
  const visitTruncated=!complete(visitSnap.size,visitSnap.docs[visitSnap.size-1]?.data()['createdAt']);
  const sharedInvoices=visitSnap.docs.map(d=>{
   const raw=d.data();if(raw['id']!==d.id||raw['tenantId']!==tenantId||raw['studioId']!==data.studioId||raw['kind']!=='shared_visit_invoice'||raw['status']!=='issued'||raw['createdAt']!==raw['issuedAt'])throw new HttpsError('failed-precondition','Shared issued invoice history needs office review.');
   try{return projectVisitInvoice(raw)}catch{throw new HttpsError('failed-precondition','Shared issued invoice snapshot needs office review.');}
  }).filter(i=>utcToLocalDate(new Date(i.issuedAt),'Asia/Kolkata').startsWith(data.month));
  const chargeSnap=await db.collection('visitCancellationChargeInvoices').where('tenantId','==',tenantId).where('studioId','==',data.studioId).limit(ACCOUNTANT_CAP+1).get();
  if(chargeSnap.size>ACCOUNTANT_CAP)throw new HttpsError('resource-exhausted','Cancellation charge invoice history exceeds the report cap.');
  const chargeInvoices=[];for(const doc of chargeSnap.docs){const raw=doc.data();if(raw['id']!==doc.id||typeof raw['visitId']!=='string')throw new HttpsError('failed-precondition','Cancellation charge invoice needs review.');const{readVisitBilling}=await import('../../lib/visit-billing.js'),bill=await db.runTransaction(tx=>readVisitBilling(tx,db,raw['visitId'])),c=bill.chargeReviews.find(c=>c.record['id']===doc.id);if(!c?.invoice||c.record['tenantId']!==tenantId||c.record['studioId']!==data.studioId||visitReturnHash(raw)!==visitReturnHash(c.invoice))throw new HttpsError('failed-precondition','Cancellation charge invoice source changed.');const i=c.invoice;if(utcToLocalDate(new Date(i['issuedAt']),'Asia/Kolkata').startsWith(data.month))chargeInvoices.push({id:i['id'] as string,invoiceNumber:i['invoiceNumber'] as string,status:'issued',issuedAt:i['issuedAt'] as string,voidedAt:null,customerName:i['customerSnapshot']['name'] as string,lineItems:[{quantity:1,unitPrice:i['totalPaise'] as number,total:i['totalPaise'] as number}],subtotal:i['subtotalPaise'] as number,discount:0,roundOffPaise:0,taxRatePercent:0,tax:0,total:i['totalPaise'] as number,currency:'INR'});}
  const retainedSnap=await db.collection('visitRetainedTransportInvoices').where('tenantId','==',tenantId).where('studioId','==',data.studioId).limit(ACCOUNTANT_CAP+1).get();
  if(retainedSnap.size>ACCOUNTANT_CAP)throw new HttpsError('resource-exhausted','Retained original invoice history exceeds the report cap.');
  const retainedInvoices=[];for(const doc of retainedSnap.docs){const raw=doc.data(),i=await db.runTransaction(async tx=>{if(raw['id']!==doc.id||typeof raw['visitId']!=='string')throw new HttpsError('failed-precondition','Retained invoice scope needs review.');const{readVisitBilling}=await import('../../lib/visit-billing.js'),bill=await readVisitBilling(tx,db,raw['visitId']),member=bill.members.find(m=>m.job.id===raw['jobId']),root=(await tx.get(db.collection('visitServiceReturns').doc(raw['jobId']))).data();if(bill.visit.tenantId!==tenantId||bill.visit.studioId!==data.studioId||!member||!root||root['retainedTransportInvoiceId']!==doc.id)throw new HttpsError('failed-precondition','Retained invoice original needs review.');const plan=(await tx.get(db.collection('visitServiceReturnPlans').doc(root['planId']))).data(),{readRetainedTransportIssuedProof}=await import('../../lib/visit-retained-transport-issued-proof.js');if(!plan)throw new HttpsError('failed-precondition','Retained invoice original missing.');const proof=await readRetainedTransportIssuedProof(tx,db,root,plan['review'],member.job.priceBreakdown);if(!proof||visitReturnHash(proof.raw)!==visitReturnHash(raw))throw new HttpsError('failed-precondition','Retained invoice changed.');return proof.invoice;});if(utcToLocalDate(new Date(i.issuedAt),'Asia/Kolkata').startsWith(data.month))retainedInvoices.push({id:i.id,invoiceNumber:i.invoiceNumber,status:'issued',issuedAt:i.issuedAt,voidedAt:null,customerName:i.customerSnapshot.name,lineItems:i.components.map(c=>({quantity:c.quantity,unitPrice:c.unitPrice,total:c.total})),subtotal:i.subtotalPaise,discount:0,roundOffPaise:0,taxRatePercent:i.taxRatePercent,tax:i.taxPaise,total:i.totalPaise,currency:'INR'});}
  const combinedInvoices=[...invoices.map(projectInvoice),...sharedInvoices,...chargeInvoices,...retainedInvoices].sort((a,b)=>(b.issuedAt??'').localeCompare(a.issuedAt??'')||a.id.localeCompare(b.id));
  if(new Set(combinedInvoices.map(i=>i.id)).size!==combinedInvoices.length)throw new HttpsError('failed-precondition','Invoice identities need office review.');
  const dayCloses = closeSnaps.filter((s) => s.exists).map((s) => projectDayClose(s.data() as Record<string, unknown>));

  const offline=offlineLedgerTotals(await readOfflineLedger(db,tenantId,data.studioId),data.month);

  const onlineRows=await readVisitOnlineLedger(db,tenantId,data.studioId),online=visitOnlineLedgerTotals(onlineRows,data.month);

  // Aggregates only when their inputs are complete. Never a silently partial accounting total.
  let report: Record<string, unknown> | null = null;
  if (!payTrunc && !expTrunc) {
    let total = 0, cash = 0, upi = 0, bank = 0, razorpay = 0;
    for (const p of payments) {
      if(p.offlineReceiptSettlement)continue;
      total += p.amount;
      if (p.method === "cash") cash += p.amount; else if (p.method === "upi_manual") upi += p.amount;
      else if (p.method === "bank_transfer") bank += p.amount; else razorpay += p.amount;
    }
    total+=offline.receivedPaise+online.receivedPaise;razorpay+=online.receivedPaise;cash+=offline.cashPaise;upi+=offline.upiPaise;bank+=offline.bankTransferPaise;
    const byCat: Record<string, number> = {};
    let exp = 0;
    for (const e of expDocs) { exp += e.amount; byCat[e.category] = (byCat[e.category] ?? 0) + e.amount; }
    report = { month: data.month, totalReceiptsPaise: total, cashPaise: cash, upiPaise: upi, bankTransferPaise: bank, razorpayPaise: razorpay,
      paymentCount: payments.filter(p=>!p.offlineReceiptSettlement).length+offline.paymentCount+online.paymentCount, expensesPaise: exp, expensesByCategory: byCat };
  }

  const serviceReturns=visitReturnLedgerTotals(await readVisitReturnLedger(db,tenantId,data.studioId),data.month);

  return {
    // Finite sanitized rows only. Manual due is already in refundsOwed.
    serviceReturns,
    month: data.month,
    studioId: data.studioId,
    cap: ACCOUNTANT_CAP,
    truncated: { payments: payTrunc, expenses: expTrunc, invoices: invTruncIssued || invTruncVoid || visitTruncated || combinedInvoices.length>ACCOUNTANT_CAP },
    report,
    onlineReceipts:onlineRows.filter(row=>utcToLocalDate(new Date(row.recognisedAt),'Asia/Kolkata').startsWith(data.month)),
    offlineReceipts:offline.receipts.map(({jobId:_jobId,actualReceiptId:_actualReceiptId,...row})=>row),
    offlineReturns:offline.returns.map(({jobId:_jobId,...row})=>row),
    offlineReceivedPaise:offline.receivedPaise,
    offlineReturnedPaise:offline.returnedPaise,
    payments: payments.slice(0, ACCOUNTANT_CAP).map(projectPayment),
    invoices: combinedInvoices.slice(0, ACCOUNTANT_CAP),
    expenses: expDocs.slice(0, ACCOUNTANT_CAP).map(projectExpense),
    dayCloses,
    refundsOwed: { paise: owed.owedPaise, count: owed.count, truncated: owed.truncated },
    notes:["Actual receipts · Not net revenue","Settlement projections excluded","Excess returns stay separate","Customer returns not netted into receipts","Refunds owed · Current open total","Not a tax-ready export"],
  };
});
