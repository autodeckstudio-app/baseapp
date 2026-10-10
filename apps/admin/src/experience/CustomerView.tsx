"use client";

// One customer, whole relationship: cars and papers, membership, visits,
// money, messages and change log, on one glass page with tabs.
import { useState } from "react";
import type { AuditLog, Booking, Customer, Invoice, Membership, Notification, Payment, Protection, ServiceJob, Vehicle, Warranty } from "@autodeck/core";
import { Segmented } from "./Office";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, formatDateTime, formatPaise, studioToday } from "../lib/format";
import { methodLabel, statusLabel } from "../lib/status-label";
import { KIND_LABEL, daysLeft } from "./VehiclesView";

type Tab = "overview" | "visits" | "money" | "messages" | "log";

export interface CustomerData {
  customer: Customer;
  vehicles: Vehicle[];
  bookings: Booking[];
  jobs: ServiceJob[];
  memberships: Membership[];
  payments: Payment[];
  invoices: Invoice[];
  notifications: Notification[];
  audit: AuditLog[];
  warranties: Warranty[];
  protections: Array<Protection & { vehicleId: string }>;
}

function Row({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return onClick ? <button type="button" className="ax-crow is-link" onClick={onClick}>{children}</button> : <div className="ax-crow">{children}</div>;
}

export function CustomerView({ d, onBack, onOpen }: { d: CustomerData; onBack: () => void; onOpen: (href: string) => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const today = studioToday();
  const paid = d.payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);
  const activeMember = d.memberships.find((m) => m.status === "active");
  const visits = d.jobs.filter((j) => j.status === "DELIVERED").length;
  const delivered = d.jobs.filter((j) => j.status === "DELIVERED");
  const outstanding = d.invoices.filter((i) => i.status !== "paid" && i.status !== "void").reduce((n, i) => n + i.total, 0);
  const lastVisit = delivered.map((j) => j.scheduledAt ?? "").sort().pop() ?? null;
  const nowIso = new Date().toISOString();
  const nextBooking = d.bookings.filter((b) => b.scheduledAt && b.scheduledAt >= nowIso && !["CANCELLED", "COMPLETED", "NO_SHOW", "MISSED"].includes(String(b.status))).map((b) => b.scheduledAt).sort()[0] ?? null;
  const avgTicket = visits > 0 ? Math.round(paid / visits) : 0;
  const waDigits = (d.customer.phone ?? "").replace(/\D/g, "");
  const timeline = [
    ...d.bookings.map((b) => ({ id: `b-${b.id}`, at: b.scheduledAt, kind: "Booking", status: b.status, amount: b.totalAmount, href: `/bookings/${b.id}` })),
    ...d.jobs.map((j) => ({ id: `j-${j.id}`, at: j.scheduledAt, kind: "Job", status: j.status, amount: j.totalAmount, href: `/jobs/${j.id}` })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return (
    <div className="ax-page">
      <button type="button" className="ax-back" onClick={onBack} style={{ background: "none", border: "none", padding: 0, minHeight: 0 }}>‹ Customers</button>
      <div className="ax-hero">
        <div>
          <p className="ax-label">Customer since {formatDate(d.customer.createdAt)}</p>
          <h1 className="ax-hero-name">{d.customer.name || "Unnamed customer"}</h1>
          <p className="ax-hero-sub">{d.customer.phone ? <a href={`tel:${d.customer.phone}`} style={{ color: "var(--ad-accent-strong)" }}>{d.customer.phone}</a> : "No phone"}{activeMember ? ` · ${statusLabel(activeMember.tier)} member` : ""}</p>
        </div>
        <div className="ax-kpis">
          <div><span className="ax-kpi-v ax-kpi-v--premium">{formatPaise(paid)}</span><span className="ax-label">Paid to date</span></div>
          <div><span className={`ax-kpi-v${outstanding > 0 ? " ax-kpi-v--accent" : ""}`}>{formatPaise(outstanding)}</span><span className="ax-label">Unpaid</span></div>
          <div><span className="ax-kpi-v">{visits}</span><span className="ax-label">Cars delivered</span></div>
          <div><span className="ax-kpi-v">{formatPaise(avgTicket)}</span><span className="ax-label">Avg per visit</span></div>
        </div>
      </div>

      <section className="ax-panel ax-cust-facts" aria-label="Contact and activity">
        <div><span className="ax-label">Phone</span><p>{d.customer.phone ? <a href={`tel:${d.customer.phone}`}>{d.customer.phone}</a> : "Not given"}{waDigits ? <> · <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer">WhatsApp</a></> : null}</p></div>
        <div><span className="ax-label">Email</span><p>{d.customer.email ? <a href={`mailto:${d.customer.email}`}>{d.customer.email}</a> : "Not given"}</p></div>
        <div><span className="ax-label">Last visit</span><p>{lastVisit ? formatDate(lastVisit) : "No visit yet"}</p></div>
        <div><span className="ax-label">Next booking</span><p>{nextBooking ? formatDateTime(nextBooking) : "None booked"}</p></div>
        <div><span className="ax-label">Membership</span><p>{activeMember ? `${statusLabel(activeMember.tier)}, ${Math.max(0, activeMember.washesTotal - activeMember.washesUsed)} washes left` : "None"}</p></div>
        <div><span className="ax-label">Alerts</span><p>{d.customer.notificationPrefs?.push ? "Push on" : "Push off"}</p></div>
      </section>

      <div className="ax-toolbar">
        <Segmented<Tab> value={tab} onChange={setTab} options={[
          { value: "overview", label: "Overview" },
          { value: "visits", label: `Visits ${timeline.length}` },
          { value: "money", label: "Money" },
          { value: "messages", label: `Messages ${d.notifications.length}` },
          { value: "log", label: "Log" },
        ]} />
      </div>

      {tab === "overview" && (
        <div className="ax-detail">
          <div className="ax-detail-main">
            <section className="ax-panel">
              <span className="ax-label">Cars</span>
              {d.vehicles.length === 0 ? <p className="ax-note" style={{ marginTop: 0 }}>No cars on file.</p> : d.vehicles.map((v) => {
                const papers = d.protections.filter((p) => p.vehicleId === v.id);
                return (
                  <div key={v.id} className="ax-car">
                    <div className="ax-car-head">
                      <span className="ax-job-plate" style={{ fontSize: 18 }}>{v.registrationNumber}</span>
                      <span className="ax-sub">{[v.year, v.make, v.model, v.color].filter(Boolean).join(" ")}{v.category ? ` · ${v.category === "suv" ? "SUV" : statusLabel(v.category)}` : ""}</span>
                    </div>
                    <p className="ax-sub" style={{ margin: "6px 0 0" }}>{d.jobs.filter((j) => j.vehicleId === v.id).length} jobs · {d.jobs.filter((j) => j.vehicleId === v.id && j.status === "DELIVERED").length} delivered</p>
                    {papers.length > 0 && (
                      <ul className="ax-chips-list" style={{ marginTop: 8 }}>
                        {papers.map((p) => {
                          const left = p.expiryDate ? daysLeft(p.expiryDate, today) : null;
                          const cls = left === null ? "" : left < 0 ? " ax-chip--danger" : left <= 30 ? " ax-chip--accent" : " ax-chip--premium";
                          return <li key={p.id} className={`ax-chip${cls}`}>{KIND_LABEL[p.kind]}{left === null ? "" : left < 0 ? " · expired" : ` · ${left}d`}</li>;
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
            <section className="ax-panel">
              <span className="ax-label">Warranties</span>
              {d.warranties.length === 0 ? <p className="ax-note" style={{ marginTop: 0 }}>No warranties issued.</p> : d.warranties.map((w) => (
                <div key={w.id} className="kv"><span>{w.warrantyLabel}</span><span>{w.endDate ? `until ${formatDate(w.endDate)}` : "No fixed end"}</span></div>
              ))}
            </section>
          </div>
          <aside className="ax-detail-side">
            <section className="ax-panel">
              <span className="ax-label">Membership</span>
              {d.memberships.length === 0 ? <p className="ax-note" style={{ marginTop: 0 }}>Not a member.</p> : d.memberships.map((m) => (
                <div key={m.id} style={{ marginBottom: 12 }}>
                  <div className="kv"><span>{statusLabel(m.tier)}</span><StatusBadge label={m.status} /></div>
                  <div className="ax-meter" aria-label={`${m.washesUsed} of ${m.washesTotal} washes used`}><span style={{ width: `${m.washesTotal ? Math.min(100, (m.washesUsed / m.washesTotal) * 100) : 0}%` }} /></div>
                  <span className="ax-sub">{m.washesUsed} of {m.washesTotal} washes used · ends {formatDate(m.endDate)}</span>
                </div>
              ))}
            </section>
            <section className="ax-panel">
              <span className="ax-label">Latest</span>
              {timeline.slice(0, 3).map((t) => (
                <Row key={t.id} onClick={() => onOpen(t.href)}><span>{t.kind} · {formatDate(t.at)}</span><StatusBadge label={t.status} /></Row>
              ))}
              {timeline.length === 0 && <p className="ax-note" style={{ marginTop: 0 }}>No visits yet.</p>}
            </section>
          </aside>
        </div>
      )}

      {tab === "visits" && (
        <section className="ax-panel">
          {timeline.length === 0 ? <p className="ax-note" style={{ margin: 0 }}>No bookings or jobs yet.</p> : timeline.map((t) => (
            <Row key={t.id} onClick={() => onOpen(t.href)}>
              <span className="ax-sub" style={{ width: 150 }}>{formatDateTime(t.at)}</span>
              <span style={{ flex: 1 }}>{t.kind}</span>
              <StatusBadge label={t.status} />
              <span className="ax-data" style={{ width: 110, textAlign: "right" }}>{formatPaise(t.amount)}</span>
            </Row>
          ))}
        </section>
      )}

      {tab === "money" && (
        <div className="ax-detail">
          <section className="ax-panel ax-detail-main">
            <span className="ax-label">Payments</span>
            {d.payments.length === 0 ? <p className="ax-note" style={{ marginTop: 0 }}>No payments.</p> : d.payments.map((p) => (
              <Row key={p.id}>
                <span className="ax-sub" style={{ width: 150 }}>{formatDateTime(p.createdAt)}</span>
                <span style={{ flex: 1 }}>{methodLabel(p.method)}</span>
                <StatusBadge label={p.status} />
                <span className="ax-data" style={{ width: 110, textAlign: "right" }}>{formatPaise(p.amount)}</span>
              </Row>
            ))}
          </section>
          <section className="ax-panel ax-detail-side">
            <span className="ax-label">Invoices</span>
            {d.invoices.length === 0 ? <p className="ax-note" style={{ marginTop: 0 }}>No invoices.</p> : d.invoices.map((inv) => (
              <Row key={inv.id} onClick={() => onOpen(`/invoices/${inv.id}`)}>
                <span className="ax-data" style={{ flex: 1 }}>{inv.invoiceNumber || "Draft"}</span>
                <StatusBadge label={inv.status} />
                <span className="ax-data">{formatPaise(inv.total)}</span>
              </Row>
            ))}
          </section>
        </div>
      )}

      {tab === "messages" && (
        <section className="ax-panel">
          {d.notifications.length === 0 ? <p className="ax-note" style={{ margin: 0 }}>No messages sent to this customer.</p> : d.notifications.map((n) => (
            <Row key={n.id}>
              <span className="ax-sub" style={{ width: 150 }}>{formatDateTime(n.createdAt)}</span>
              <span style={{ flex: 1, whiteSpace: "normal" }}>{n.body}<span className="ax-sub">{statusLabel(n.type)}</span></span>
              <span className="ax-sub">{n.readAt ? "Read" : "Not read"}</span>
            </Row>
          ))}
        </section>
      )}

      {tab === "log" && (
        <section className="ax-panel">
          {d.audit.length === 0 ? <p className="ax-note" style={{ margin: 0 }}>No changes recorded for this profile.</p> : d.audit.map((a) => (
            <Row key={a.id}>
              <span className="ax-sub" style={{ width: 150 }}>{formatDateTime(a.createdAt)}</span>
              <span style={{ flex: 1 }}>{statusLabel(a.action)}</span>
              <span className="ax-sub">{statusLabel(a.performedByRole)}</span>
            </Row>
          ))}
        </section>
      )}
    </div>
  );
}
