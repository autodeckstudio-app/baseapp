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

function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y!, (mo! - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y!, mo! - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return <span className="ax-bar" aria-hidden="true"><span style={{ width: `${value > 0 ? pct : 0}%` }} /></span>;
}

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
  const maxDay = days.reduce((m, d) => Math.max(m, d[1]), 0);
  const methods = r ? [["Cash", r.cashPaise], ["UPI (manual)", r.upiPaise], ["Online (Razorpay)", r.razorpayPaise], ["Bank transfer", r.bankTransferPaise]] as [string, number][] : [];
  const maxMethod = methods.reduce((m, d) => Math.max(m, d[1]), 0);
  const maxCat = categories.reduce((m, d) => Math.max(m, d[1]), 0);
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

      <div className="rp-month-wrap">
        <div className="rp-month" role="group" aria-label="Month">
          <button type="button" className="ax-button" aria-label="Previous month" onClick={() => p.onMonthChange(shiftMonth(p.month, -1))}>‹</button>
          <span className="rp-month-label" aria-live="polite">{monthLabel(p.month)}</span>
          <button type="button" className="ax-button" aria-label="Next month" onClick={() => p.onMonthChange(shiftMonth(p.month, 1))}>›</button>
        </div>
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
                <ul className="rp-list">
                  {days.map(([date, amount]) => (
                    <li key={date} className="rp-row">
                      <span className="rp-name">
                        <span className="ax-person-name">{formatDate(date)}</span>
                        {bestDay && date === bestDay[0] && <span className="ax-sub">best day</span>}
                      </span>
                      <Bar value={amount} max={maxDay} />
                      <span className="rp-amt">{formatPaise(amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="ax-detail-side">
            <section className="ax-panel">
              <span className="ax-label">Revenue by method</span>
              <ul className="rp-list">
                {methods.map(([name, amt]) => (
                  <li key={name} className="rp-row"><span className="rp-name">{name}</span><Bar value={amt} max={maxMethod} /><span className="rp-amt">{formatPaise(amt)}</span></li>
                ))}
              </ul>
              <p className="ax-note">{r.paymentCount} completed payments</p>
            </section>

            <section className="ax-panel">
              <span className="ax-label">Expenses by category</span>
              {categories.length === 0 ? (
                <p className="ax-note">No expenses recorded this month.</p>
              ) : (
                <ul className="rp-list">
                  {categories.map(([cat, amount]) => (
                    <li key={cat} className="rp-row"><span className="rp-name">{CATEGORY_NAME[cat] ?? cat}</span><Bar value={amount} max={maxCat} /><span className="rp-amt">{formatPaise(amount)}</span></li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ax-panel">
              <span className="ax-label">Jobs</span>
              <ul className="rp-list">
                <li className="rp-row"><span className="rp-name">Booked in</span><span className="rp-amt">{r.jobsCreated}</span></li>
                <li className="rp-row"><span className="rp-name">Delivered</span><span className="rp-amt ax-success">{r.jobsCompleted}</span></li>
                <li className="rp-row"><span className="rp-name">Cancelled</span><span className="rp-amt ax-danger">{r.jobsCancelled}</span></li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
