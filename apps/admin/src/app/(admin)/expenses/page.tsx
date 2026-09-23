"use client";

import { useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { Expense } from "@autodeck/core";
import { listenToExpenses, createExpense, deleteExpense } from "../../../lib/expense-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { ExpensesView } from "../../../experience/ExpensesView";

function kolkataMonth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
}

export default function ExpensesPage() {
  const { claims } = useAdminAuth();
  const [month, setMonth] = useState(kolkataMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const studioId = claims?.studioId ?? FIRST_STUDIO_ID;

  useEffect(() => {
    if (!claims) return;
    setLoading(true);
    const unsub = listenToExpenses(
      claims.tenantId,
      studioId,
      month,
      (rows) => { setExpenses(rows); setLoading(false); },
      () => { setError("Couldn't load expenses."); setLoading(false); },
    );
    return unsub;
  }, [claims, studioId, month]);

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(ok);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ExpensesView
      month={month}
      expenses={expenses}
      loading={loading}
      busy={busy}
      error={error}
      message={message}
      onMonthChange={setMonth}
      onAdd={(input) =>
        void run(
          () =>
            createExpense({
              studioId,
              amount: input.amountPaise,
              category: input.category,
              paidVia: input.paidVia,
              date: input.date,
              ...(input.vendor ? { vendor: input.vendor } : {}),
              ...(input.notes ? { notes: input.notes } : {}),
            }),
          "Expense recorded.",
          "Couldn't record the expense.",
        )
      }
      onDelete={(e) => void run(() => deleteExpense(e.id), "Expense deleted.", "Couldn't delete the expense.")}
    />
  );
}
