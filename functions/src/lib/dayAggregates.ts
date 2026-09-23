import { getFirestore } from "firebase-admin/firestore";
import type { Expense, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { utcToLocalDate } from "./schedule.js";

export interface DayAggregates {
  cashPaise: number; // completed cash payments (gross, before cash expenses)
  upiPaise: number;
  bankTransferPaise: number;
  razorpayPaise: number; // card/netbanking via payment link
  totalRevenuePaise: number;
  paymentCount: number;
  expensesPaise: number; // all recorded expenses for the date
  cashExpensesPaise: number;
  expenseCount: number;
  expectedCashPaise: number; // cashPaise - cashExpensesPaise
}

/**
 * Computes one studio's payment/expense totals for one Asia/Kolkata business
 * date. Shared by Daily Close, the Office dashboard and Reports so every
 * surface shows identical numbers.
 */
export async function dayAggregates(
  tenantId: string,
  studioId: string,
  date: string,
): Promise<DayAggregates> {
  const db = getFirestore();

  const paymentsSnap = await db
    .collection(COLLECTIONS.payments())
    .where("tenantId", "==", tenantId)
    .where("studioId", "==", studioId)
    .where("status", "==", "completed")
    .orderBy("completedAt", "desc")
    .limit(1000)
    .get();

  const agg: DayAggregates = {
    cashPaise: 0,
    upiPaise: 0,
    bankTransferPaise: 0,
    razorpayPaise: 0,
    totalRevenuePaise: 0,
    paymentCount: 0,
    expensesPaise: 0,
    cashExpensesPaise: 0,
    expenseCount: 0,
    expectedCashPaise: 0,
  };

  for (const doc of paymentsSnap.docs) {
    const p = doc.data() as Payment;
    if (!p.completedAt) continue;
    if (utcToLocalDate(new Date(p.completedAt), "Asia/Kolkata") !== date) continue;
    agg.paymentCount += 1;
    agg.totalRevenuePaise += p.amount;
    if (p.method === "cash") agg.cashPaise += p.amount;
    else if (p.method === "upi_manual") agg.upiPaise += p.amount;
    else if (p.method === "bank_transfer") agg.bankTransferPaise += p.amount;
    else agg.razorpayPaise += p.amount;
  }

  const expensesSnap = await db
    .collection(COLLECTIONS.expenses())
    .where("tenantId", "==", tenantId)
    .where("studioId", "==", studioId)
    .where("date", "==", date)
    .limit(500)
    .get();

  for (const doc of expensesSnap.docs) {
    const e = doc.data() as Expense;
    agg.expenseCount += 1;
    agg.expensesPaise += e.amount;
    if (e.paidVia === "CASH") agg.cashExpensesPaise += e.amount;
  }

  agg.expectedCashPaise = agg.cashPaise - agg.cashExpensesPaise;
  return agg;
}
