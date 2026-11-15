"use client";

import { refundsOwedTotalText } from "../../../lib/refund-owed-copy";
import { useCallback, useEffect, useRef, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { getAccountantMoney, type AccountantMoney } from "../../../lib/accountant-service";
import{VisitReturnTotals}from"../../../components/VisitReturnTotals";
import{useAdminAuth}from"../../../lib/auth-context";
import { LOCAL_VISIT_MONEY_PREVIEW, ACCOUNTANT_MONEY_ENABLED } from "../../../lib/backend-features";
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
  const{claims}=useAdminAuth(),studioId=LOCAL_VISIT_MONEY_PREVIEW?claims?.studioId??null:FIRST_STUDIO_ID;
  const generation=useRef(0);
  const [month, setMonth] = useState(kolkataMonth());
  const [data, setData] = useState<AccountantMoney | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const version=++generation.current;setLoading(true);setError(null);setData(null);
    if(!studioId){setLoading(false);return;}
    try{const result=ACCOUNTANT_MONEY_ENABLED ? await getAccountantMoney(studioId,month):null;if(version===generation.current){if(result&&(result.month!==month||result.studioId!==studioId))throw Error('Money scope needs review.');setData(result);}}
    catch(e){if(version===generation.current){setData(null);setError(e instanceof Error&&e.message?e.message:"Couldn't load Money.");}}
    finally{if(version===generation.current)setLoading(false);}
  },[month,studioId]);
  useEffect(()=>{void load();return()=>{generation.current++}},[load]);

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
          {LOCAL_VISIT_MONEY_PREVIEW?<VisitReturnTotals value={data.serviceReturns}/>:null}
          <section className="ax-panel" aria-label="Notes">
            {data.notes.map((n) => <p key={n} className="ax-note">{n}</p>)}
            {trunc.length > 0 && <p className="ax-status-msg ax-status-msg--warn" role="alert">More than {data.cap} rows for: {trunc.join(", ")}. Totals are not shown because they would be incomplete.</p>}
          </section>
          {refundsOwedTotalText(data.refundsOwed.paise, data.refundsOwed.count, data.refundsOwed.truncated) ? <section className="ax-panel" aria-label="Refunds owed"><p className="ax-note" data-testid="refunds-owed-total">{refundsOwedTotalText(data.refundsOwed.paise, data.refundsOwed.count, data.refundsOwed.truncated)}</p></section> : null}
          <section className="ax-panel" aria-label="Receipts and expenses">
            <span className="ax-label">Month summary</span>
            {data.report ? (
              <dl className="ax-kv">
                <div className="kv"><dt>Gross receipts</dt><dd>{formatPaise(data.report.totalReceiptsPaise)}</dd></div>
                <div className="kv"><dt>Cash received</dt><dd>{formatPaise(data.report.cashPaise)}</dd></div>
                <div className="kv"><dt>Manual UPI received</dt><dd>{formatPaise(data.report.upiPaise)}</dd></div>
                <div className="kv"><dt>Bank received</dt><dd>{formatPaise(data.report.bankTransferPaise)}</dd></div>
                <div className="kv"><dt>Online received</dt><dd>{formatPaise(data.report.razorpayPaise)}</dd></div>
                <div className="kv"><dt>Receipt sources</dt><dd>{data.report.paymentCount}</dd></div>
                <div className="kv"><dt>Expenses</dt><dd>{formatPaise(data.report.expensesPaise)}</dd></div>
              </dl>
            ) : <p className="ax-note">Not shown: the data set is larger than the cap.</p>}
          </section>
          {data.offlineReceipts && <section className="ax-panel" aria-label="Actual offline receipts">
            <span className="ax-label">Actual offline receipts</span><p className="ax-note">Actual receipt applications · Not new receipts</p>
            <div className="kv"><span>Received this month</span><span>{formatPaise(data.offlineReceivedPaise ?? 0)}</span></div><div className="kv"><span>Excess returned this month</span><span>{formatPaise(data.offlineReturnedPaise ?? 0)}</span></div>
            {data.offlineReceipts.map(r=><div className="kv" key={r.id}><span>{formatDate(r.createdAt)} - {r.method}</span><span>Received {formatPaise(r.receivedPaise)} / applied {formatPaise(r.appliedPaise)} / excess {formatPaise(r.officeReturnDuePaise)}</span></div>)}
            {(data.offlineReturns ?? []).map(r=><div className="kv" key={r.id}><span>{formatDate(r.createdAt)} - {r.method}</span><span>Returned {formatPaise(r.amountPaise)}</span></div>)}
          </section>}
          <section className="ax-panel" aria-label="Invoices">
            <span className="ax-label">Invoices ({data.invoices.length})</span>
            <div role="region" aria-label="Invoice rows" tabIndex={0} style={{overflowX:"auto",maxWidth:"100%"}}><table className="ax-table"><thead><tr><th>Number</th><th>Issued</th><th>Customer</th><th>Status</th><th>Tax</th><th>Total</th></tr></thead>
              <tbody>{data.invoices.map((i) => <tr key={i.id}><td>{i.invoiceNumber}</td><td>{formatDate(i.issuedAt)}</td><td>{i.customerName ?? "-"}</td><td>{i.status}</td><td>{formatPaise(i.tax)} ({i.taxRatePercent===null?'Mixed':`${i.taxRatePercent}%`})</td><td>{formatPaise(i.total)}{i.roundOffPaise ? <small> (round off {formatPaise(i.roundOffPaise)})</small> : null}</td></tr>)}</tbody></table></div>
          </section>
          <section className="ax-panel" aria-label="Payments">
            <span className="ax-label">Original payments ({data.payments.length})</span>
            <div role="region" aria-label="Payment rows" tabIndex={0} style={{overflowX:"auto",maxWidth:"100%"}}><table className="ax-table"><thead><tr><th>Completed</th><th>Method</th><th>Amount</th><th>Refunded</th></tr></thead>
              <tbody>{data.payments.map((p) => <tr key={p.id}><td>{formatDate(p.completedAt)}</td><td>{p.method}{p.offlineReceiptSettlement ? " (settlement projection, not a new receipt)" : ""}</td><td>{formatPaise(p.amount)}</td><td>{p.refundAmount ? formatPaise(p.refundAmount) : "-"}</td></tr>)}</tbody></table></div>
          </section>
          <section className="ax-panel" aria-label="Expenses">
            <span className="ax-label">Expenses ({data.expenses.length})</span>
            <div role="region" aria-label="Expense rows" tabIndex={0} style={{overflowX:"auto",maxWidth:"100%"}}><table className="ax-table"><thead><tr><th>Date</th><th>Category</th><th>Paid via</th><th>Amount</th></tr></thead>
              <tbody>{data.expenses.map((e) => <tr key={e.id}><td>{formatDate(e.date)}</td><td>{e.category}</td><td>{e.paidVia}</td><td>{formatPaise(e.amount)}</td></tr>)}</tbody></table></div>
          </section>
          <section className="ax-panel" aria-label="Daily close">
            <span className="ax-label">Daily close ({data.dayCloses.length})</span>
            <div role="region" aria-label="Daily close rows" tabIndex={0} style={{overflowX:"auto",maxWidth:"100%"}}><table className="ax-table"><thead><tr><th>Date</th><th>Status</th><th>Expected cash</th><th>Counted</th><th>Variance</th></tr></thead>
              <tbody>{data.dayCloses.map((d) => <tr key={String(d["id"])}><td>{formatDate(String(d["date"]))}</td><td>{String(d["status"])}</td><td>{formatPaise(Number(d["expectedCashPaise"]))}</td><td>{formatPaise(Number(d["countedCashPaise"]))}</td><td>{formatPaise(Number(d["variancePaise"]))}</td></tr>)}</tbody></table></div>
          </section>
        </>
      )}
    </div>
  );
}
