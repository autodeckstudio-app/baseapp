"use client";

import { refundsOwedTotalText } from "../../../lib/refund-owed-copy";
import { useCallback, useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { getAccountantMoney, type AccountantMoney } from "../../../lib/accountant-service";
import { ACCOUNTANT_MONEY_ENABLED } from "../../../lib/backend-features";
import { formatDate, formatPaise } from "../../../lib/format";

function kolkataMonth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
}
function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y!, (mo! - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Read-only Money for the accountant role. Every figure comes from the server projection (getAccountantMoney).
export default function AccountantPage() {
  const [month, setMonth] = useState(kolkataMonth());
  const [data, setData] = useState<AccountantMoney | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(ACCOUNTANT_MONEY_ENABLED ? await getAccountantMoney(FIRST_STUDIO_ID, month) : null); }
    catch (e) { setData(null); setError(e instanceof Error && e.message ? e.message : "Couldn't load Money."); }
    finally { setLoading(false); }
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  const trunc = data ? Object.entries(data.truncated).filter(([, v]) => v).map(([k]) => k) : [];
  return (
    <div className="ax-page">
      <p className="ax-label">Accountant, read only</p>
      <h1 className="ax-h1">Money</h1>
      {error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{error}</p>}
      <div className="rp-month" role="group" aria-label="Month">
        <button type="button" className="ax-button" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <span className="rp-month-label" aria-live="polite">{month}</span>
        <button type="button" className="ax-button" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>
      {!ACCOUNTANT_MONEY_ENABLED ? <p className="ax-note">This view turns on when its backend is enabled.</p> : null}
      {loading ? <div className="ax-skel ax-skel--row" /> : !data ? null : (
        <>
          <section className="ax-panel" aria-label="Notes">
            {data.notes.map((n) => <p key={n} className="ax-note">{n}</p>)}
            {trunc.length > 0 && <p className="ax-status-msg ax-status-msg--warn" role="alert">More than {data.cap} rows for: {trunc.join(", ")}. Totals are not shown because they would be incomplete.</p>}
          </section>
          {refundsOwedTotalText(data.refundsOwed.paise, data.refundsOwed.count, data.refundsOwed.truncated) ? <section className="ax-panel" aria-label="Refunds owed"><p className="ax-note" data-testid="refunds-owed-total">{refundsOwedTotalText(data.refundsOwed.paise, data.refundsOwed.count, data.refundsOwed.truncated)}</p></section> : null}
          <section className="ax-panel" aria-label="Receipts and expenses">
            <span className="ax-label">Month summary</span>
            {data.report ? (
              <dl className="ax-kv">
                <div className="kv"><dt>Receipts (cash held)</dt><dd>{formatPaise(data.report.totalReceiptsPaise)}</dd></div>
                <div className="kv"><dt>Cash</dt><dd>{formatPaise(data.report.cashPaise)}</dd></div>
                <div className="kv"><dt>UPI (manual)</dt><dd>{formatPaise(data.report.upiPaise)}</dd></div>
                <div className="kv"><dt>Bank transfer</dt><dd>{formatPaise(data.report.bankTransferPaise)}</dd></div>
                <div className="kv"><dt>Online (Razorpay)</dt><dd>{formatPaise(data.report.razorpayPaise)}</dd></div>
                <div className="kv"><dt>Payments</dt><dd>{data.report.paymentCount}</dd></div>
                <div className="kv"><dt>Expenses</dt><dd>{formatPaise(data.report.expensesPaise)}</dd></div>
              </dl>
            ) : <p className="ax-note">Not shown: the data set is larger than the cap.</p>}
          </section>
          <section className="ax-panel" aria-label="Invoices">
            <span className="ax-label">Invoices ({data.invoices.length})</span>
            <table className="ax-table"><thead><tr><th>Number</th><th>Issued</th><th>Customer</th><th>Status</th><th>Tax</th><th>Total</th></tr></thead>
              <tbody>{data.invoices.map((i) => <tr key={i.id}><td>{i.invoiceNumber}</td><td>{formatDate(i.issuedAt)}</td><td>{i.customerName ?? "-"}</td><td>{i.status}</td><td>{formatPaise(i.tax)} ({i.taxRatePercent}%)</td><td>{formatPaise(i.total)}</td></tr>)}</tbody></table>
          </section>
          <section className="ax-panel" aria-label="Payments">
            <span className="ax-label">Payments ({data.payments.length})</span>
            <table className="ax-table"><thead><tr><th>Completed</th><th>Method</th><th>Amount</th><th>Refunded</th></tr></thead>
              <tbody>{data.payments.map((p) => <tr key={p.id}><td>{formatDate(p.completedAt)}</td><td>{p.method}</td><td>{formatPaise(p.amount)}</td><td>{p.refundAmount ? formatPaise(p.refundAmount) : "-"}</td></tr>)}</tbody></table>
          </section>
          <section className="ax-panel" aria-label="Expenses">
            <span className="ax-label">Expenses ({data.expenses.length})</span>
            <table className="ax-table"><thead><tr><th>Date</th><th>Category</th><th>Paid via</th><th>Amount</th></tr></thead>
              <tbody>{data.expenses.map((e) => <tr key={e.id}><td>{formatDate(e.date)}</td><td>{e.category}</td><td>{e.paidVia}</td><td>{formatPaise(e.amount)}</td></tr>)}</tbody></table>
          </section>
          <section className="ax-panel" aria-label="Daily close">
            <span className="ax-label">Daily close ({data.dayCloses.length})</span>
            <table className="ax-table"><thead><tr><th>Date</th><th>Status</th><th>Expected cash</th><th>Counted</th><th>Variance</th></tr></thead>
              <tbody>{data.dayCloses.map((d) => <tr key={String(d["id"])}><td>{formatDate(String(d["date"]))}</td><td>{String(d["status"])}</td><td>{formatPaise(Number(d["expectedCashPaise"]))}</td><td>{formatPaise(Number(d["countedCashPaise"]))}</td><td>{formatPaise(Number(d["variancePaise"]))}</td></tr>)}</tbody></table>
          </section>
        </>
      )}
    </div>
  );
}
