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
  return onClick ? <button type="button" className="ad-crow is-link" onClick={onClick}>{children}</button> : <div className="ad-crow">{children}</div>;
}

export function CustomerView({ d, onBack, onOpen }: { d: CustomerData; onBack: () => void; onOpen: (href: string) => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const today = studioToday();
  const paid = d.payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);
  const activeMember = d.memberships.find((m) => m.status === "active");
  const visits = d.jobs.filter((j) => j.status === "DELIVERED").length;
  const timeline = [
    ...d.bookings.map((b) => ({ id: `b-${b.id}`, at: b.scheduledAt, kind: "Booking", status: b.status, amount: b.totalAmount, href: `/bookings/${b.id}` })),
    ...d.jobs.map((j) => ({ id: `j-${j.id}`, at: j.scheduledAt, kind: "Job", status: j.status, amount: j.totalAmount, href: `/jobs/${j.id}` })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return (
    <div className="ad-page">
      <button type="button" className="ad-back" onClick={onBack} style={{ background: "none", border: "none", padding: 0, minHeight: 0 }}>‹ Customers</button>
      <div className="ad-hero">
        <div>
          <p className="ad-label">Customer since {formatDate(d.customer.createdAt)}</p>
          <h1 className="ad-hero-name">{d.customer.name || "Unnamed customer"}</h1>
          <p className="ad-hero-sub">{d.customer.phone ? <a href={`tel:${d.customer.phone}`} style={{ color: "var(--ad-accent-strong)" }}>{d.customer.phone}</a> : "No phone"}{activeMember ? ` · ${statusLabel(activeMember.tier)} member` : ""}</p>
        </div>
        <div className="ad-kpis">
          <div><span className="ad-kpi-v ad-kpi-v--premium">{formatPaise(paid)}</span><span className="ad-label">Paid to date</span></div>
          <div><span className="ad-kpi-v">{visits}</span><span className="ad-label">Cars delivered</span></div>
          <div><span className="ad-kpi-v">{d.vehicles.length}</span><span className="ad-label">Cars</span></div>
        </div>
      </div>

      <div className="ad-toolbar">
        <Segmented<Tab> value={tab} onChange={setTab} options={[
          { value: "overview", label: "Overview" },
          { value: "visits", label: `Visits ${timeline.length}` },
          { value: "money", label: "Money" },
          { value: "messages", label: `Messages ${d.notifications.length}` },
          { value: "log", label: "Log" },
        ]} />
      </div>

      {tab === "overview" && (
        <div className="ad-detail">
          <div className="ad-detail-main">
            <section className="ad-panel">
              <span className="ad-label">Cars</span>
              {d.vehicles.length === 0 ? <p className="ad-note" style={{ marginTop: 0 }}>No cars on file.</p> : d.vehicles.map((v) => {
                const papers = d.protections.filter((p) => p.vehicleId === v.id);
                return (
                  <div key={v.id} className="ad-car">
                    <div className="ad-car-head">
                      <span className="ad-job-plate" style={{ fontSize: 18 }}>{v.registrationNumber}</span>
                      <span className="ad-sub">{[v.year, v.make, v.model].filter(Boolean).join(" ")}{v.category ? ` · ${v.category === "suv" ? "SUV" : statusLabel(v.category)}` : ""}</span>
                    </div>
                    {papers.length > 0 && (
                      <ul className="ad-chips-list" style={{ marginTop: 8 }}>
                        {papers.map((p) => {
                          const left = p.expiryDate ? daysLeft(p.expiryDate, today) : null;
                          const cls = left === null ? "" : left < 0 ? " ad-chip--danger" : left <= 30 ? " ad-chip--accent" : " ad-chip--premium";
                          return <li key={p.id} className={`ad-chip${cls}`}>{KIND_LABEL[p.kind]}{left === null ? "" : left < 0 ? " · expired" : ` · ${left}d`}</li>;
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
            <section className="ad-panel">
              <span className="ad-label">Warranties</span>
              {d.warranties.length === 0 ? <p className="ad-note" style={{ marginTop: 0 }}>No warranties issued.</p> : d.warranties.map((w) => (
                <div key={w.id} className="kv"><span>{w.warrantyLabel}</span><span>{w.endDate ? `until ${formatDate(w.endDate)}` : "No fixed end"}</span></div>
              ))}
            </section>
          </div>
          <aside className="ad-detail-side">
            <section className="ad-panel">
              <span className="ad-label">Membership</span>
              {d.memberships.length === 0 ? <p className="ad-note" style={{ marginTop: 0 }}>Not a member.</p> : d.memberships.map((m) => (
                <div key={m.id} style={{ marginBottom: 12 }}>
                  <div className="kv"><span>{statusLabel(m.tier)}</span><StatusBadge label={m.status} /></div>
                  <div className="ad-meter" aria-label={`${m.washesUsed} of ${m.washesTotal} washes used`}><span style={{ width: `${m.washesTotal ? Math.min(100, (m.washesUsed / m.washesTotal) * 100) : 0}%` }} /></div>
                  <span className="ad-sub">{m.washesUsed} of {m.washesTotal} washes used · ends {formatDate(m.endDate)}</span>
                </div>
              ))}
            </section>
            <section className="ad-panel">
              <span className="ad-label">Latest</span>
              {timeline.slice(0, 3).map((t) => (
                <Row key={t.id} onClick={() => onOpen(t.href)}><span>{t.kind} · {formatDate(t.at)}</span><StatusBadge label={t.status} /></Row>
              ))}
              {timeline.length === 0 && <p className="ad-note" style={{ marginTop: 0 }}>No visits yet.</p>}
            </section>
          </aside>
        </div>
      )}

      {tab === "visits" && (
        <section className="ad-panel">
          {timeline.length === 0 ? <p className="ad-note" style={{ margin: 0 }}>No bookings or jobs yet.</p> : timeline.map((t) => (
            <Row key={t.id} onClick={() => onOpen(t.href)}>
              <span className="ad-sub" style={{ width: 150 }}>{formatDateTime(t.at)}</span>
              <span style={{ flex: 1 }}>{t.kind}</span>
              <StatusBadge label={t.status} />
              <span className="ad-data" style={{ width: 110, textAlign: "right" }}>{formatPaise(t.amount)}</span>
            </Row>
          ))}
        </section>
      )}

      {tab === "money" && (
        <div className="ad-detail">
          <section className="ad-panel ad-detail-main">
            <span className="ad-label">Payments</span>
            {d.payments.length === 0 ? <p className="ad-note" style={{ marginTop: 0 }}>No payments.</p> : d.payments.map((p) => (
              <Row key={p.id}>
                <span className="ad-sub" style={{ width: 150 }}>{formatDateTime(p.createdAt)}</span>
                <span style={{ flex: 1 }}>{methodLabel(p.method)}</span>
                <StatusBadge label={p.status} />
                <span className="ad-data" style={{ width: 110, textAlign: "right" }}>{formatPaise(p.amount)}</span>
              </Row>
            ))}
          </section>
          <section className="ad-panel ad-detail-side">
            <span className="ad-label">Invoices</span>
            {d.invoices.length === 0 ? <p className="ad-note" style={{ marginTop: 0 }}>No invoices.</p> : d.invoices.map((inv) => (
              <Row key={inv.id} onClick={() => onOpen(`/invoices/${inv.id}`)}>
                <span className="ad-data" style={{ flex: 1 }}>{inv.invoiceNumber || "Draft"}</span>
                <StatusBadge label={inv.status} />
                <span className="ad-data">{formatPaise(inv.total)}</span>
              </Row>
            ))}
          </section>
        </div>
      )}

      {tab === "messages" && (
        <section className="ad-panel">
          {d.notifications.length === 0 ? <p className="ad-note" style={{ margin: 0 }}>No messages sent to this customer.</p> : d.notifications.map((n) => (
            <Row key={n.id}>
              <span className="ad-sub" style={{ width: 150 }}>{formatDateTime(n.createdAt)}</span>
              <span style={{ flex: 1, whiteSpace: "normal" }}>{n.body}<span className="ad-sub">{statusLabel(n.type)}</span></span>
              <span className="ad-sub">{n.readAt ? "Read" : "Not read"}</span>
            </Row>
          ))}
        </section>
      )}

      {tab === "log" && (
        <section className="ad-panel">
          {d.audit.length === 0 ? <p className="ad-note" style={{ margin: 0 }}>No changes recorded for this profile.</p> : d.audit.map((a) => (
            <Row key={a.id}>
              <span className="ad-sub" style={{ width: 150 }}>{formatDateTime(a.createdAt)}</span>
              <span style={{ flex: 1 }}>{statusLabel(a.action)}</span>
              <span className="ad-sub">{statusLabel(a.performedByRole)}</span>
            </Row>
          ))}
        </section>
      )}
    </div>
  );
}
