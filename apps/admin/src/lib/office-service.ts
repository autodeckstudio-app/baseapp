"use client";

import { httpsCallable } from "firebase/functions";
import type { DailyClose } from "@autodeck/core";
import { functions } from "./firebase";

export interface DayAggregates {
  cashPaise: number;
  upiPaise: number;
  bankTransferPaise: number;
  razorpayPaise: number;
  totalRevenuePaise: number;
  paymentCount: number;
  expensesPaise: number;
  cashExpensesPaise: number;
  expenseCount: number;
  expectedCashPaise: number;
}

export async function getDailyClose(
  studioId: string,
  date: string,
): Promise<{ close: DailyClose | null; live: DayAggregates }> {
  const fn = httpsCallable<{ studioId: string; date: string }, { close: DailyClose | null; live: DayAggregates }>(
    functions,
    "getDailyClose",
  );
  return (await fn({ studioId, date })).data;
}

export async function performDailyClose(input: {
  studioId: string;
  date: string;
  countedCashPaise: number;
  notes?: string;
  reclose?: boolean;
}): Promise<{ id: string; variancePaise: number }> {
  const fn = httpsCallable<typeof input, { id: string; variancePaise: number }>(functions, "performDailyClose");
  return (await fn(input)).data;
}

export interface OfficeReport {
  month: string;
  studioId: string;
  totalRevenuePaise: number;
  cashPaise: number;
  upiPaise: number;
  bankTransferPaise: number;
  razorpayPaise: number;
  paymentCount: number;
  revenueByDay: Record<string, number>;
  expensesPaise: number;
  expensesByCategory: Record<string, number>;
  netPaise: number;
  jobsCreated: number;
  jobsCompleted: number;
  jobsCancelled: number;
}

export async function getOfficeReport(studioId: string, month: string): Promise<OfficeReport> {
  const fn = httpsCallable<{ studioId: string; month: string }, OfficeReport>(functions, "getOfficeReport");
  return (await fn({ studioId, month })).data;
}
