"use client";
import { Icon } from "./Icon";
import type { IconName } from "@autodeck/ui/theme";

// Office dashboard: a calm morning brief. What needs a person, what is on
// the floor, what came in. Presentational only; the page feeds it counts.
import Link from "next/link";
import { formatPaise, formatDayLong } from "../lib/format";

const SECTIONS = [
  { href: "/studio", label: "Studio", description: "Opening hours, holidays, bays and booking rules." },
  { href: "/services", label: "Pricing", description: "What you offer and what it costs per car size." },
  { href: "/memberships", label: "Memberships", description: "Plans, included washes and member discounts." },
  { href: "/vehicles", label: "Vehicles", description: "Find a car and manage its protection records." },
  { href: "/staff", label: "Team", description: "Who can sign in, and whether they see Studio or Office." },
];

export function greeting(now: Date): string {
  const h = Number(now.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export interface DashboardViewProps {
  today: string;
  now: Date;
  revenueToday: number;
  tiles: { bookings: number; active: number; delivered: number; walkins: number; staffPresent: number };
  floor: { arriving: number; working: number; ready: number; delivered: number };
  counts: { failedPayments: number; unpaidDelivered: number; pendingApprovals: number; staleJobs: number; pendingPayments: number; expiringMemberships: number; lowStock: number; pendingPapers: number };
  onOpen: (href: string) => void;
}

export function DashboardView({ today, now, revenueToday, tiles, floor, counts, onOpen }: DashboardViewProps) {
  const alerts: { tone: "danger" | "warning"; text: string; href: string; action: string }[] = [];
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  if (counts.failedPayments) alerts.push({ tone: "danger", text: `${n(counts.failedPayments, "payment", "payments")} failed`, href: "/payments", action: "Review" });
  if (counts.unpaidDelivered) alerts.push({ tone: "danger", text: `${n(counts.unpaidDelivered, "delivered car", "delivered cars")} not paid for yet`, href: "/jobs", action: "Collect" });
  if (counts.pendingApprovals) alerts.push({ tone: "warning", text: `${n(counts.pendingApprovals, "extra-work request is", "extra-work requests are")} waiting on the customer`, href: "/jobs", action: "View" });
  if (counts.staleJobs) alerts.push({ tone: "warning", text: `${n(counts.staleJobs, "job hasn't", "jobs haven't")} moved in over 48 hours`, href: "/jobs", action: "Check" });
  if (counts.pendingPayments) alerts.push({ tone: "warning", text: `${n(counts.pendingPayments, "payment is", "payments are")} waiting for confirmation`, href: "/payments", action: "Confirm" });
  if (counts.expiringMemberships) alerts.push({ tone: "warning", text: `${n(counts.expiringMemberships, "membership ends", "memberships end")} within 7 days`, href: "/memberships", action: "View" });
  if (counts.lowStock) alerts.push({ tone: "warning", text: `${n(counts.lowStock, "item is", "items are")} at or below low-stock`, href: "/inventory", action: "Restock" });
  if (counts.pendingPapers) alerts.push({ tone: "warning", text: `${n(counts.pendingPapers, "document is", "documents are")} waiting for verification`, href: "/papers", action: "Review" });

  return (
    <div className="ax-page">
      <header className="ax-page-head">
        <div>
          <p className="ax-label">{formatDayLong(today)}</p>
          <h1>{greeting(now)}</h1>
        </div>
        <div className="ax-hero-side">
          <span className="ax-label">Taken today</span>
          <span className="ax-hero-total">{formatPaise(revenueToday)}</span>
        </div>
      </header>

      <div className="ax-tiles">
        <Tile icon="calendar" featured value={tiles.bookings} label="Bookings today" onClick={() => onOpen("/bookings")} />
        <Tile icon="wrench" value={tiles.active} label="Cars in progress" tone="accent" onClick={() => onOpen("/jobs")} />
        <Tile icon="check" value={tiles.delivered} label="Delivered today" tone="premium" onClick={() => onOpen("/jobs")} />
      </div>

      <div className="ax-detail" style={{ marginTop: "var(--ad-space-inset)" }}>
        <div className="ax-detail-main">
          <section className="ax-panel">
            <span className="ax-label">Needs attention</span>
            {alerts.length === 0 ? (
              <div className="ax-allclear">
                <span className="ax-allclear-dot" aria-hidden="true" />
                <div>
                  <p className="ax-title" style={{ margin: 0, fontSize: 20 }}>All clear</p>
                  <p style={{ margin: "4px 0 0" }}>No failed payments, stuck jobs or waiting approvals.</p>
                </div>
              </div>
            ) : (
              <ul className="ax-alerts">
                {alerts.map((al) => (
                  <li key={al.text} className={`ax-alert-row ax-alert-row--${al.tone}`}>
                    <span className="ax-alert-dot" aria-hidden="true" />
                    <span>{al.text}</span>
                    <Link href={al.href} className="ax-button">{al.action}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="ax-detail-side">
          <section className="ax-panel">
            <span className="ax-label">On the floor now</span>
            <div className="kv"><span>Arriving today</span><span className="ax-data">{floor.arriving}</span></div>
            <div className="kv"><span>Being worked on</span><span className="ax-data" style={{ color: "var(--ad-accent)" }}>{floor.working}</span></div>
            <div className="kv"><span>Ready for pickup</span><span className="ax-data" style={{ color: "var(--ad-premium)" }}>{floor.ready}</span></div>
            <div className="kv"><span>Delivered today</span><span className="ax-data">{floor.delivered}</span></div>
            <div className="ax-panel-actions">
              <Link href="/jobs" className="ax-button ax-button--primary">Open studio floor</Link>
            </div>
          </section>
          <section className="ax-panel">
            <span className="ax-label">Money</span>
            <div className="kv"><span>Taken today</span><span className="ax-data">{formatPaise(revenueToday)}</span></div>
            <div className="kv"><span>Awaiting confirmation</span><span className="ax-data">{counts.pendingPayments}</span></div>
            <div className="kv"><span>Failed</span><span className="ax-data" style={counts.failedPayments ? { color: "var(--ad-danger)" } : undefined}>{counts.failedPayments}</span></div>
            <div className="ax-panel-actions">
              <Link href="/payments" className="ax-button">Payments</Link>
              <Link href="/invoices" className="ax-button">Invoices</Link>
            </div>
          </section>
        </aside>
      </div>
      <details className="ax-panel ax-setup" style={{ marginTop: "var(--ad-space-inset)" }}>
        <summary className="ax-label" style={{ cursor: "pointer" }}>Set up your studio</summary>
        <div className="ax-links" style={{ marginTop: "var(--ad-space-gap)" }}>
          {SECTIONS.map((sec) => (
            <Link key={sec.href} href={sec.href} className="ax-linkcard">
              <span className="ax-linkcard-title">{sec.label}</span>
              <span className="ax-linkcard-desc">{sec.description}</span>
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}

function Tile({ value, label, tone, icon, featured, onClick }: { value: number | string; label: string; tone?: "accent" | "premium"; icon?: IconName; featured?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`ax-tile${featured ? " ax-tile--featured" : ""}`} onClick={onClick}>
      {icon ? <span className="ax-tile-ico" aria-hidden="true"><Icon name={icon} size={30} /></span> : null}
      <span className={`ax-kpi-v${tone ? ` ax-kpi-v--${tone}` : ""}`}>{value}</span>
      <span className="ax-label">{label}</span>
    </button>
  );
}
