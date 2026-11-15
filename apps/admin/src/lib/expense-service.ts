"use client";

import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { Expense, ExpenseCategory, ExpensePaidVia } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

/** Live expense feed for one studio and month (YYYY-MM). */
export function listenToExpenses(
  tenantId: string,
  studioId: string,
  month: string,
  onData: (expenses: Expense[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.expenses()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("month", "==", month),
  );
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => d.data() as Expense).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))),
    onError,
  );
}

export async function createExpense(input: {
  studioId: string;
  amount: number; // paise
  category: ExpenseCategory;
  paidVia: ExpensePaidVia;
  vendor?: string;
  date: string;
  notes?: string;
}): Promise<{ id: string }> {
  const fn = httpsCallable<typeof input, { id: string }>(functions, "createExpense");
  return (await fn(input)).data;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const fn = httpsCallable<{ expenseId: string }, { id: string }>(functions, "deleteExpense");
  await fn({ expenseId });
}
