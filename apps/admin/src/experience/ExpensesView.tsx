"use client";

// Expenses: studio operating costs by month. Feeds Daily Close and Reports,
// so entries here move real numbers — deletes ask twice.
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

  return (
    <div className="ad-page">
      <PageHead
        eyebrow="Office"
        title="Expenses"
        kpis={[
          { value: formatPaise(total), label: "This month" },
          { value: formatPaise(cashOut), label: "Paid in cash", tone: "premium" },
          { value: p.expenses.length, label: "Entries" },
        ]}
      />
      {p.error && <p className="ad-status-msg ad-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ad-status-msg">{p.message}</p>}

      <div className="ad-detail">
        <div className="ad-detail-main">
          <section className="ad-panel">
            <div className="ad-form-pair" style={{ marginBottom: "var(--ad-space-gap)" }}>
              <span className="ad-label">Month</span>
              <input type="month" value={p.month} onChange={(e) => e.target.value && p.onMonthChange(e.target.value)} aria-label="Month" />
            </div>
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ad-skel ad-skel--row" />)
            ) : p.expenses.length === 0 ? (
              <p className="ad-note">No expenses recorded for this month.</p>
            ) : (
              <ul className="ad-list">
                {p.expenses.map((e) => (
                  <li key={e.id} className="ad-list-row">
                    <span className="ad-slot-main">
                      <span className="ad-person-name">
                        {CATEGORY_NAME[e.category]}{e.vendor ? ` · ${e.vendor}` : ""}
                      </span>
                      <span className="ad-sub">
                        {formatDate(e.date)} · {PAID_VIA_NAME[e.paidVia]}{e.notes ? ` · ${e.notes}` : ""}
                      </span>
                    </span>
                    <span className="ad-slot-amt">{formatPaise(e.amount)}</span>
                    {confirmId === e.id ? (
                      <span className="ad-row-actions">
                        <button type="button" className="ad-button ad-button--danger" disabled={p.busy} onClick={() => { p.onDelete(e); setConfirmId(null); }}>
                          Delete entry
                        </button>
                        <button type="button" className="ad-button" onClick={() => setConfirmId(null)}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" className="ad-button" onClick={() => setConfirmId(e.id)}>Delete</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="ad-detail-side">
          <section className="ad-panel">
            <span className="ad-label">Record expense</span>
            <div className="ad-form-section">
              <div className="ad-form-pair">
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ₹" inputMode="decimal" aria-label="Amount in rupees" disabled={p.busy} />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" disabled={p.busy} />
              </div>
              <div className="ad-form-pair">
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
                className="ad-button ad-button--primary"
                disabled={p.busy || !amountOk || !date}
                onClick={() => {
                  p.onAdd({ amountPaise: Math.round(amountRupees * 100), category, paidVia, vendor: vendor.trim(), date, notes: notes.trim() });
                  setAmount(""); setVendor(""); setNotes("");
                }}
              >
                Record expense
              </button>
              <p className="ad-note">Cash expenses count against the drawer in Daily Close.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
