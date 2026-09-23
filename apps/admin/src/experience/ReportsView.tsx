"use client";

// Reports: the monthly Office view — revenue by method and day, expenses by
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
    <div className="ad-page">
      <PageHead
        eyebrow="Office"
        title="Reports"
        kpis={r ? [
          { value: formatPaise(r.totalRevenuePaise), label: "Revenue" },
          { value: formatPaise(r.expensesPaise), label: "Expenses" },
          { value: formatPaise(r.netPaise), label: "Net", tone: r.netPaise >= 0 ? "premium" : "accent" },
        ] : []}
      />
      {p.error && <p className="ad-status-msg ad-status-msg--warn" role="alert">{p.error}</p>}

      <div className="ad-form-pair" style={{ maxWidth: 320, marginBottom: "var(--ad-space-gap)" }}>
        <span className="ad-label">Month</span>
        <input type="month" value={p.month} onChange={(e) => e.target.value && p.onMonthChange(e.target.value)} aria-label="Month" />
      </div>

      {p.loading ? (
        [0, 1, 2].map((i) => <div key={i} className="ad-skel ad-skel--row" />)
      ) : !r ? null : (
        <div className="ad-detail">
          <div className="ad-detail-main">
            <section className="ad-panel">
              <span className="ad-label">Revenue by day</span>
              {days.length === 0 ? (
                <p className="ad-note">No completed payments this month.</p>
              ) : (
                <ul className="ad-list">
                  {days.map(([date, amount]) => (
                    <li key={date} className="ad-list-row">
                      <span className="ad-slot-main">
                        <span className="ad-person-name">{formatDate(date)}</span>
                        {bestDay && date === bestDay[0] && <span className="ad-sub">best day</span>}
                      </span>
                      <span className="ad-slot-amt">{formatPaise(amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="ad-detail-side">
            <section className="ad-panel">
              <span className="ad-label">Revenue by method</span>
              <ul className="ad-list">
                <li className="ad-list-row"><span className="ad-slot-main">Cash</span><span className="ad-slot-amt">{formatPaise(r.cashPaise)}</span></li>
                <li className="ad-list-row"><span className="ad-slot-main">UPI (manual)</span><span className="ad-slot-amt">{formatPaise(r.upiPaise)}</span></li>
                <li className="ad-list-row"><span className="ad-slot-main">Online (Razorpay)</span><span className="ad-slot-amt">{formatPaise(r.razorpayPaise)}</span></li>
                <li className="ad-list-row"><span className="ad-slot-main">Bank transfer</span><span className="ad-slot-amt">{formatPaise(r.bankTransferPaise)}</span></li>
              </ul>
              <p className="ad-note">{r.paymentCount} completed payments</p>
            </section>

            <section className="ad-panel">
              <span className="ad-label">Expenses by category</span>
              {categories.length === 0 ? (
                <p className="ad-note">No expenses recorded this month.</p>
              ) : (
                <ul className="ad-list">
                  {categories.map(([cat, amount]) => (
                    <li key={cat} className="ad-list-row"><span className="ad-slot-main">{CATEGORY_NAME[cat] ?? cat}</span><span className="ad-slot-amt">{formatPaise(amount)}</span></li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ad-panel">
              <span className="ad-label">Jobs</span>
              <ul className="ad-list">
                <li className="ad-list-row"><span className="ad-slot-main">Booked in</span><span className="ad-slot-amt">{r.jobsCreated}</span></li>
                <li className="ad-list-row"><span className="ad-slot-main">Delivered</span><span className="ad-slot-amt ad-success">{r.jobsCompleted}</span></li>
                <li className="ad-list-row"><span className="ad-slot-main">Cancelled</span><span className="ad-slot-amt ad-danger">{r.jobsCancelled}</span></li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
