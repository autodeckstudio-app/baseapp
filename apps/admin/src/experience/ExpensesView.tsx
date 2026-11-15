"use client";

// Expenses: studio operating costs by month. Feeds Daily Close and Reports,
// so entries here move real numbers - deletes ask twice.
import { useState } from "react";
import type { Expense, ExpenseCategory, ExpensePaidVia } from "@autodeck/core";
import { PageHead } from "./Office";
import { formatDate, formatPaise } from "../lib/format";

const CATEGORY_NAME: Record<ExpenseCategory, string> = {
  SUPPLIES: "Supplies",
  EQUIPMENT: "Equipment",
  RENT: "Rent",
  UTILITIES: "Utilities",
  SALARY_ADVANCE: "Salary advance",
  MAINTENANCE: "Maintenance",
  MARKETING: "Marketing",
  OTHER: "Other",
};

const PAID_VIA_NAME: Record<ExpensePaidVia, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

export function ExpensesView(p: {
  month: string;
  expenses: Expense[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  onMonthChange: (month: string) => void;
  onAdd: (input: { amountPaise: number; category: ExpenseCategory; paidVia: ExpensePaidVia; vendor: string; date: string; notes: string }) => void;
  onDelete: (expense: Expense) => void;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("SUPPLIES");
  const [paidVia, setPaidVia] = useState<ExpensePaidVia>("CASH");
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(p.month + "-01");
  const [notes, setNotes] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const total = p.expenses.reduce((s, e) => s + e.amount, 0);
  const cashOut = p.expenses.filter((e) => e.paidVia === "CASH").reduce((s, e) => s + e.amount, 0);
  const amountRupees = Number(amount);
  const amountOk = Number.isFinite(amountRupees) && amountRupees > 0;

  if(p.loading) return <div className="ax-panel" role="status">Loading expenses...</div>;
  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Office"
        title="Expenses"
        kpis={[
          { value: formatPaise(total), label: "This month" },
          { value: formatPaise(cashOut), label: "Paid in cash", tone: "premium" },
          { value: p.expenses.length, label: "Entries" },
        ]}
      />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            <div className="ax-form-pair" style={{ marginBottom: "var(--ad-space-gap)" }}>
              <span className="ax-label">Month</span>
              <input type="month" value={p.month} onChange={(e) => e.target.value && p.onMonthChange(e.target.value)} aria-label="Month" />
            </div>
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ax-skel ax-skel--row" />)
            ) : p.expenses.length === 0 ? (
              <p className="ax-note">No expenses recorded for this month.</p>
            ) : (
              <ul className="ax-list">
                {p.expenses.map((e) => (
                  <li key={e.id} className="ax-list-row">
                    <span className="ax-slot-main">
                      <span className="ax-person-name">
                        {CATEGORY_NAME[e.category]}{e.vendor ? ` · ${e.vendor}` : ""}
                      </span>
                      <span className="ax-sub">
                        {formatDate(e.date)} · {PAID_VIA_NAME[e.paidVia]}{e.notes ? ` · ${e.notes}` : ""}
                      </span>
                    </span>
                    <span className="ax-slot-amt">{formatPaise(e.amount)}</span>
                    {confirmId === e.id ? (
                      <span className="ax-row-actions">
                        <button type="button" className="ax-button ax-button--danger" disabled={p.busy} onClick={() => { p.onDelete(e); setConfirmId(null); }}>
                          Delete entry
                        </button>
                        <button type="button" className="ax-button" onClick={() => setConfirmId(null)}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" className="ax-button" onClick={() => setConfirmId(e.id)}>Delete</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="ax-detail-side">
          <section className="ax-panel">
            <span className="ax-label">Record expense</span>
            <div className="ax-form-section">
              <div className="ax-form-pair">
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ₹" inputMode="decimal" aria-label="Amount in rupees" disabled={p.busy} />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" disabled={p.busy} />
              </div>
              <div className="ax-form-pair">
                <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} aria-label="Category" disabled={p.busy}>
                  {(Object.keys(CATEGORY_NAME) as ExpenseCategory[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_NAME[c]}</option>
                  ))}
                </select>
                <select value={paidVia} onChange={(e) => setPaidVia(e.target.value as ExpensePaidVia)} aria-label="Paid via" disabled={p.busy}>
                  {(Object.keys(PAID_VIA_NAME) as ExpensePaidVia[]).map((v) => (
                    <option key={v} value={v}>{PAID_VIA_NAME[v]}</option>
                  ))}
                </select>
              </div>
              <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor (optional)" aria-label="Vendor" disabled={p.busy} />
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)" aria-label="Note" disabled={p.busy} />
              <button
                type="button"
                className="ax-button ax-button--primary"
                disabled={p.busy || !amountOk || !date}
                onClick={() => {
                  p.onAdd({ amountPaise: Math.round(amountRupees * 100), category, paidVia, vendor: vendor.trim(), date, notes: notes.trim() });
                  setAmount(""); setVendor(""); setNotes("");
                }}
              >
                Record expense
              </button>
              <p className="ax-note">Cash expenses count against the drawer in Daily Close.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
