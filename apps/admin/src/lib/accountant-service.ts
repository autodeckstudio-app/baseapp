"use client";

import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export interface AccountantMoney {
  month: string;
  studioId: string;
  cap: number;
  truncated: { payments: boolean; expenses: boolean; invoices: boolean };
  report: null | { month: string; totalReceiptsPaise: number; cashPaise: number; upiPaise: number; bankTransferPaise: number; razorpayPaise: number; paymentCount: number; expensesPaise: number; expensesByCategory: Record<string, number> };
  payments: Array<{ id: string; amount: number; currency: string; method: string; status: string; completedAt: string | null; createdAt: string; refundAmount: number | null; invoiceId: string | null }>;
  invoices: Array<{ id: string; invoiceNumber: string; status: string; issuedAt: string | null; voidedAt: string | null; customerName: string | null; lineItems: Array<{ quantity: number; unitPrice: number; total: number }>; subtotal: number; discount: number; taxRatePercent: number; tax: number; total: number; currency: string }>;
  expenses: Array<{ id: string; amount: number; category: string; paidVia: string; date: string; month: string }>;
  dayCloses: Array<Record<string, unknown>>;
  refundsOwed: { paise: number; count: number; truncated: boolean };
  notes: string[];
}

export async function getAccountantMoney(studioId: string, month: string): Promise<AccountantMoney> {
  const fn = httpsCallable<{ studioId: string; month: string }, AccountantMoney>(functions, "getAccountantMoney");
  return (await fn({ studioId, month })).data;
}
