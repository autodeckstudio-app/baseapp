"use client";

// Reports: the monthly Office view - revenue by method and day, expenses by
// category, job throughput. Same server-side sources as Daily Close, so the
// numbers always agree.
import type { OfficeReport } from "../lib/office-service";
import { PageHead } from "./Office";
import { formatDate, formatPaise } from "../lib/format";

const CATEGORY_NAME: Record<string, string> = {
  SUPPLIES: "Supplies",
  EQUIPMENT: "Equipment",
  RENT: "Rent",
  UTILITIES: "Utilities",
  SALARY_ADVANCE: "Salary advance",
  MAINTENANCE: "Maintenance",
  MARKETING: "Marketing",
  OTHER: "Other",
};

export function ReportsView(p: {
  month: string;
  report: OfficeReport | null;
  loading: boolean;
  error: string | null;
  onMonthChange: (month: string) => void;
}) {
  const r = p.report;
  const days = r ? Object.entries(r.revenueByDay).sort(([a], [b]) => a.localeCompare(b)) : [];
  const categories = r ? Object.entries(r.expensesByCategory).sort(([, a], [, b]) => b - a) : [];
  const bestDay = days.length ? days.reduce((best, d) => (d[1] > best[1] ? d : best)) : null;

  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Office"
        title="Reports"
        kpis={r ? [
          { value: formatPaise(r.totalRevenuePaise), label: "Revenue" },
          { value: formatPaise(r.expensesPaise), label: "Expenses" },
          { value: formatPaise(r.netPaise), label: "Net", tone: r.netPaise >= 0 ? "premium" : "accent" },
        ] : []}
      />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}

      <div className="ax-form-pair" style={{ maxWidth: 320, marginBottom: "var(--ad-space-gap)" }}>
        <span className="ax-label">Month</span>
        <input type="month" value={p.month} onChange={(e) => e.target.value && p.onMonthChange(e.target.value)} aria-label="Month" />
      </div>

      {p.loading ? (
        [0, 1, 2].map((i) => <div key={i} className="ax-skel ax-skel--row" />)
      ) : !r ? null : (
        <div className="ax-detail">
          <div className="ax-detail-main">
            <section className="ax-panel">
              <span className="ax-label">Revenue by day</span>
              {days.length === 0 ? (
                <p className="ax-note">No completed payments this month.</p>
              ) : (
                <ul className="ax-list">
                  {days.map(([date, amount]) => (
                    <li key={date} className="ax-list-row">
                      <span className="ax-slot-main">
                        <span className="ax-person-name">{formatDate(date)}</span>
                        {bestDay && date === bestDay[0] && <span className="ax-sub">best day</span>}
                      </span>
                      <span className="ax-slot-amt">{formatPaise(amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="ax-detail-side">
            <section className="ax-panel">
              <span className="ax-label">Revenue by method</span>
              <ul className="ax-list">
                <li className="ax-list-row"><span className="ax-slot-main">Cash</span><span className="ax-slot-amt">{formatPaise(r.cashPaise)}</span></li>
                <li className="ax-list-row"><span className="ax-slot-main">UPI (manual)</span><span className="ax-slot-amt">{formatPaise(r.upiPaise)}</span></li>
                <li className="ax-list-row"><span className="ax-slot-main">Online (Razorpay)</span><span className="ax-slot-amt">{formatPaise(r.razorpayPaise)}</span></li>
                <li className="ax-list-row"><span className="ax-slot-main">Bank transfer</span><span className="ax-slot-amt">{formatPaise(r.bankTransferPaise)}</span></li>
              </ul>
              <p className="ax-note">{r.paymentCount} completed payments</p>
            </section>

            <section className="ax-panel">
              <span className="ax-label">Expenses by category</span>
              {categories.length === 0 ? (
                <p className="ax-note">No expenses recorded this month.</p>
              ) : (
                <ul className="ax-list">
                  {categories.map(([cat, amount]) => (
                    <li key={cat} className="ax-list-row"><span className="ax-slot-main">{CATEGORY_NAME[cat] ?? cat}</span><span className="ax-slot-amt">{formatPaise(amount)}</span></li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ax-panel">
              <span className="ax-label">Jobs</span>
              <ul className="ax-list">
                <li className="ax-list-row"><span className="ax-slot-main">Booked in</span><span className="ax-slot-amt">{r.jobsCreated}</span></li>
                <li className="ax-list-row"><span className="ax-slot-main">Delivered</span><span className="ax-slot-amt ax-success">{r.jobsCompleted}</span></li>
                <li className="ax-list-row"><span className="ax-slot-main">Cancelled</span><span className="ax-slot-amt ax-danger">{r.jobsCancelled}</span></li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
