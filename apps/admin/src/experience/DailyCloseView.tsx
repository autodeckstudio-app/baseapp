"use client";

// Daily Close: end-of-day cash reconciliation. Expected figures come from the
// server (completed payments minus cash expenses); the Office counts the
// drawer and closes the day. Re-closing recomputes and is audited.
import { useState } from "react";
import type { DailyClose } from "@autodeck/core";
import type { DayAggregates } from "../lib/office-service";
import { PageHead } from "./Office";
import { formatPaise, formatDateTime } from "../lib/format";

export function DailyCloseView(p: {
  date: string;
  close: DailyClose | null;
  live: DayAggregates | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  onDateChange: (date: string) => void;
  onClose: (countedCashPaise: number, notes: string, reclose: boolean) => void;
}) {
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const countedRupees = Number(counted);
  const countedOk = Number.isFinite(countedRupees) && countedRupees >= 0 && counted !== "";
  const expected = p.close?.expectedCashPaise ?? p.live?.expectedCashPaise ?? 0;
  const variancePreview = countedOk ? Math.round(countedRupees * 100) - expected : null;

  if(p.loading) return <div className="ax-panel" role="status">Loading daily close...</div>;
  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Office"
        title="Daily Close"
        kpis={p.live ? [
          { value: formatPaise(p.live.totalRevenuePaise), label: "Revenue" },
          { value: formatPaise(p.live.expensesPaise), label: "Expenses" },
          { value: formatPaise(p.live.expectedCashPaise), label: "Expected cash", tone: "premium" },
        ] : []}
      />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            <div className="ax-form-pair" style={{ marginBottom: "var(--ad-space-gap)" }}>
              <span className="ax-label">Date</span>
              <input type="date" value={p.date} onChange={(e) => e.target.value && p.onDateChange(e.target.value)} aria-label="Date" />
            </div>
            {p.loading ? (
              [0, 1].map((i) => <div key={i} className="ax-skel ax-skel--row" />)
            ) : (
              <ul className="ax-list ax-cash-summary">
                <li className="ax-list-row"><span className="ax-slot-main"><span className="ax-person-name">Cash payments</span><span className="ax-sub">{p.live?.paymentCount ?? 0} completed payments today</span></span><span className="ax-slot-amt">{formatPaise(p.live?.cashPaise ?? 0)}</span></li>
                <li className="ax-list-row"><span className="ax-slot-main"><span className="ax-person-name">UPI (manual)</span></span><span className="ax-slot-amt">{formatPaise(p.live?.upiPaise ?? 0)}</span></li>
                <li className="ax-list-row"><span className="ax-slot-main"><span className="ax-person-name">Online (Razorpay)</span></span><span className="ax-slot-amt">{formatPaise(p.live?.razorpayPaise ?? 0)}</span></li>
                <li className="ax-list-row"><span className="ax-slot-main"><span className="ax-person-name">Bank transfer</span></span><span className="ax-slot-amt">{formatPaise(p.live?.bankTransferPaise ?? 0)}</span></li>
                <li className="ax-list-row"><span className="ax-slot-main"><span className="ax-person-name">Cash expenses</span><span className="ax-sub">{p.live?.expenseCount ?? 0} expenses recorded today</span></span><span className="ax-slot-amt ax-danger">−{formatPaise(p.live?.cashExpensesPaise ?? 0)}</span></li>
                <li className="ax-list-row"><span className="ax-slot-main"><span className="ax-person-name">Expected in drawer</span></span><span className="ax-slot-amt ax-kpi-v--premium">{formatPaise(expected)}</span></li>
              </ul>
            )}
          </section>

          {p.close && (
            <section className="ax-panel">
              <span className="ax-label">Closed · {formatDateTime(p.close.closedAt)}{p.close.closeCount > 1 ? ` · closed ${p.close.closeCount} times` : ""}</span>
              <p className="ax-note">
                Counted {formatPaise(p.close.countedCashPaise)} against expected {formatPaise(p.close.expectedCashPaise)} - variance{" "}
                <strong className={p.close.variancePaise === 0 ? "ax-success" : "ax-danger"}>{formatPaise(p.close.variancePaise)}</strong>.
                {p.close.notes ? ` Note: ${p.close.notes}` : ""}
              </p>
            </section>
          )}
        </div>

        <div className="ax-detail-side">
          <section className="ax-panel">
            <span className="ax-label">{p.close ? "Re-close this day" : "Close this day"}</span>
            <div className="ax-form-section">
              <input value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Counted cash in drawer ₹" inputMode="decimal" aria-label="Counted cash" disabled={p.busy} />
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)" aria-label="Note" disabled={p.busy} />
              {variancePreview !== null && (
                <p className={`ax-status-msg ${variancePreview === 0 ? "" : "ax-status-msg--warn"}`}>
                  Variance: {formatPaise(variancePreview)}
                </p>
              )}
              <button
                type="button"
                className="ax-button ax-button--primary"
                disabled={p.busy || !countedOk || p.loading}
                onClick={() => { p.onClose(Math.round(countedRupees * 100), notes.trim(), p.close !== null); setCounted(""); setNotes(""); }}
              >
                {p.close ? "Recompute and re-close" : "Close the day"}
              </button>
              <p className="ax-note">
                Closing snapshots today's numbers. Payments or expenses added afterwards only show up if you re-close.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
