"use client";

// Presentational office lists. Pages own data and actions; these own the
// look, so the /design previews render exactly what staff see.
import Link from "next/link";
import { auditActor, auditTarget, auditVerb } from "../lib/audit-display";
import { useState } from "react";
import type { AuditLog, Customer, Invoice, InvoiceStatus, Payment, PaymentStatus } from "@autodeck/core";
import { PageHead, Toolbar, Segmented, ListPane, Drawer, type Column } from "./Office";
import { StatusBadge } from "../components/StatusBadge";
import { formatPaise, formatDate, formatDateTime, studioToday } from "../lib/format";
import { methodLabel, statusLabel } from "../lib/status-label";

type Names = Record<string, string>;

/* ---------------- Customers ---------------- */

export function CustomersView(p: {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearch: (q: string) => void;
  onPlateLookup: (plate: string) => void;
  plateMessage: string | null;
  onOpen: (id: string) => void;
}) {
  const q = p.search.trim().toLowerCase();
  const rows = q ? p.customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)) : p.customers;
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const newThisMonth = p.customers.filter((c) => c.createdAt >= monthAgo).length;
  const cols: Column<Customer>[] = [
    { key: "name", head: "Customer", kind: "strong", width: "minmax(0, 2fr)", cell: (c) => c.name || "Unnamed customer" },
    { key: "phone", head: "Phone", kind: "data", width: "minmax(0, 1.2fr)", cell: (c) => c.phone || "Not added" },
    { key: "joined", head: "Customer since", kind: "muted", width: "minmax(0, 1fr)", align: "end", cell: (c) => formatDate(c.createdAt) },
  ];
  if (p.error) return <div className="ax-panel ax-empty" role="alert"><p className="ax-title">Records unavailable</p><p>{p.error}</p><button type="button" className="ax-button" onClick={() => window.location.reload()}>Retry</button></div>;
  if (p.loading) return <div className="ax-panel" role="status">Loading records...</div>;
  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Office"
        title="Customers"
        kpis={[
          { value: p.customers.length, label: "Customers" },
          { value: newThisMonth, label: "New in 30 days", tone: "premium" },
        ]}
      />
      <Toolbar count={{ shown: rows.length, total: p.customers.length }}>
        <input className="ax-search" type="search" aria-label="Search customers by name or phone" placeholder="Search name or phone" value={p.search} onChange={(e) => p.onSearch(e.target.value)} />
        <PlateLookup onLookup={p.onPlateLookup} />
      </Toolbar>
      {p.plateMessage && <p className="ax-status-msg ax-status-msg--warn">{p.plateMessage}</p>}
      <ListPane
        rows={rows}
        columns={cols}
        loading={p.loading}
        error={p.error}
        onOpen={(c) => p.onOpen(c.id)}
        empty={q ? { title: "No one matches that", body: "Try part of the name or the last digits of the phone number." } : { title: "No customers yet", body: "Customers appear here after their first booking or sign-in." }}
      />
    </div>
  );
}

function PlateLookup({ onLookup }: { onLookup: (plate: string) => void }) {
  const [plate, setPlate] = useState("");
  return (
    <form className="ax-inline-form" onSubmit={(e) => { e.preventDefault(); onLookup(plate); }}>
      <input className="ax-search ax-search--plate" aria-label="Vehicle registration" placeholder="Number plate" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} />
      <button type="submit" className="ax-button" disabled={plate.trim().length < 4}>Find</button>
    </form>
  );
}

/* ---------------- Payments ---------------- */

const PAYMENT_FILTERS: { value: PaymentStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

export function PaymentsView(p: {
  payments: Payment[];
  names: Names;
  loading: boolean;
  error: string | null;
  status: PaymentStatus | "";
  onStatus: (s: PaymentStatus | "") => void;
  search: string;
  onSearch: (q: string) => void;
  message: string | null;
  refundingId: string | null;
  onRefund: (id: string, reason: string) => void;
  onOpenInvoice: (id: string) => void;
  today: string;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const q = p.search.trim().toLowerCase();
  const rows = p.payments.filter((x) => {
    if (p.status === "pending" ? !(x.status === "pending" || x.status === "processing") : p.status && x.status !== p.status) return false;
    if (!q) return true;
    return [x.id, x.customerId, x.jobId, x.bookingId, p.names[x.customerId]].filter(Boolean).join(" ").toLowerCase().includes(q);
  });
  const done = p.payments.filter((x) => x.status === "completed");
  const takenToday = done.filter((x) => studioToday(new Date(x.createdAt)) === p.today).reduce((s, x) => s + x.amount, 0);
  const waiting = p.payments.filter((x) => x.status === "pending" || x.status === "processing").length;
  const failed = p.payments.filter((x) => x.status === "failed").length;

  const cols: Column<Payment>[] = [
    { key: "when", head: "When", kind: "muted", width: "150px", cell: (x) => formatDateTime(x.createdAt) },
    { key: "who", head: "Customer", kind: "strong", width: "minmax(0, 1.6fr)", cell: (x) => p.names[x.customerId] ?? "Customer" },
    { key: "how", head: "Method", width: "110px", cell: (x) => methodLabel(x.method) },
    { key: "status", head: "Status", width: "120px", cell: (x) => <StatusBadge label={x.status} /> },
    { key: "amt", head: "Amount", kind: "data", align: "end", width: "110px", cell: (x) => formatPaise(x.amount) },
    {
      key: "act",
      head: "",
      align: "end",
      width: "minmax(180px, 1.2fr)",
      cell: (x) => (
        <span className="ax-row-actions">
          {x.invoiceId && <button type="button" className="ax-button" onClick={() => p.onOpenInvoice(x.invoiceId ?? "")}>Invoice</button>}
          {x.status === "completed" && (confirmId === x.id ? (
            <>
              <input placeholder="Reason for refund" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Refund reason" />
              <button type="button" className="ax-button ax-button--danger" disabled={p.refundingId === x.id || !reason.trim()} onClick={() => p.onRefund(x.id, reason.trim())}>
                {p.refundingId === x.id ? "Refunding" : "Refund"}
              </button>
              <button type="button" className="ax-button" onClick={() => { setConfirmId(null); setReason(""); }}>Keep</button>
            </>
          ) : (
            <button type="button" className="ax-button" onClick={() => { setConfirmId(x.id); setReason(""); }}>Refund</button>
          ))}
        </span>
      ),
    },
  ];
  if (p.error) return <div className="ax-panel ax-empty" role="alert"><p className="ax-title">Records unavailable</p><p>{p.error}</p><button type="button" className="ax-button" onClick={() => window.location.reload()}>Retry</button></div>;
  if (p.loading) return <div className="ax-panel" role="status">Loading records...</div>;
  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Money"
        title="Payments"
        kpis={[
          { value: formatPaise(takenToday), label: "Taken today", tone: "premium" },
          { value: waiting, label: "Awaiting confirmation", tone: waiting ? "accent" : undefined },
          { value: failed, label: "Failed", tone: failed ? "danger" : undefined },
        ]}
      />
      <Toolbar count={{ shown: rows.length, total: p.payments.length }}>
        <Segmented value={p.status} options={PAYMENT_FILTERS} onChange={p.onStatus} />
        <input className="ax-search" type="search" aria-label="Search payments" placeholder="Search customer, job or booking" value={p.search} onChange={(e) => p.onSearch(e.target.value)} />
      </Toolbar>
      {p.message && <p className="ax-status-msg">{p.message}</p>}
      <ListPane
        rows={rows}
        columns={cols}
        loading={p.loading}
        error={p.error}
        empty={p.payments.length ? { title: "Nothing matches these filters", body: "Clear the search or pick a different status." } : { title: "No payments yet", body: "Payments show up here as soon as they are taken at the counter or online." }}
      />
    </div>
  );
}

/* ---------------- Invoices ---------------- */

const INVOICE_FILTERS: { value: InvoiceStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "issued", label: "Issued" },
  { value: "paid", label: "Paid" },
  { value: "draft", label: "Draft" },
  { value: "void", label: "Void" },
];

export function InvoicesView(p: {
  invoices: Invoice[];
  names: Names;
  loading: boolean;
  error: string | null;
  status: InvoiceStatus | "";
  onStatus: (s: InvoiceStatus | "") => void;
  search: string;
  onSearch: (q: string) => void;
  onOpen: (id: string) => void;
}) {
  const q = p.search.trim().toLowerCase();
  const rows = p.invoices.filter((inv) => {
    if (p.status && inv.status !== p.status) return false;
    if (!q) return true;
    return [inv.invoiceNumber, inv.id, inv.customerId, p.names[inv.customerId]].filter(Boolean).join(" ").toLowerCase().includes(q);
  });
  const outstanding = p.invoices.filter((i) => i.status === "issued");
  const outstandingSum = outstanding.reduce((s, i) => s + i.total, 0);
  const gst = p.invoices.filter((i) => i.status === "paid" || i.status === "issued").reduce((s, i) => s + i.tax, 0);
  const cols: Column<Invoice>[] = [
    { key: "no", head: "Invoice", kind: "data", width: "minmax(0, 1.1fr)", cell: (i) => i.invoiceNumber || "Draft" },
    { key: "who", head: "Customer", kind: "strong", width: "minmax(0, 1.6fr)", cell: (i) => p.names[i.customerId] ?? "Customer" },
    { key: "status", head: "Status", width: "110px", cell: (i) => <StatusBadge label={i.status} /> },
    { key: "issued", head: "Issued", kind: "muted", width: "150px", cell: (i) => formatDateTime(i.issuedAt) },
    { key: "gst", head: "GST", kind: "data", align: "end", width: "100px", cell: (i) => formatPaise(i.tax) },
    { key: "total", head: "Total", kind: "data", align: "end", width: "120px", cell: (i) => formatPaise(i.total) },
  ];
  if (p.error) return <div className="ax-panel ax-empty" role="alert"><p className="ax-title">Records unavailable</p><p>{p.error}</p><button type="button" className="ax-button" onClick={() => window.location.reload()}>Retry</button></div>;
  if (p.loading) return <div className="ax-panel" role="status">Loading records...</div>;
  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Money"
        title="Invoices"
        kpis={[
          { value: formatPaise(outstandingSum), label: `${outstanding.length} unpaid`, tone: outstanding.length ? "accent" : undefined },
          { value: formatPaise(gst), label: "GST billed" },
        ]}
      />
      <Toolbar count={{ shown: rows.length, total: p.invoices.length }}>
        <Segmented value={p.status} options={INVOICE_FILTERS} onChange={p.onStatus} />
        <input className="ax-search" type="search" aria-label="Search invoices" placeholder="Search invoice number or customer" value={p.search} onChange={(e) => p.onSearch(e.target.value)} />
      </Toolbar>
      <ListPane
        rows={rows}
        columns={cols}
        loading={p.loading}
        error={p.error}
        onOpen={(i) => p.onOpen(i.id)}
        empty={p.invoices.length ? { title: "Nothing matches these filters", body: "Clear the search or pick a different status." } : { title: "No invoices yet", body: "An invoice is created when a job is billed." }}
      />
    </div>
  );
}

/* ---------------- Audit log ---------------- */

export function AuditView(p: {
  entries: AuditLog[];
  loading: boolean;
  error: string | null;
  who: Names;
  labels?: Names;
}) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [date, setDate] = useState("");
  const [actor, setActor] = useState("");
  const actors = Array.from(new Set(p.entries.map((e) => e.performedBy)));
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const actions = Array.from(new Set(p.entries.map((e) => e.action))).sort();
  const types = Array.from(new Set(p.entries.map((e) => e.entityType))).sort();
  const q = search.trim().toLowerCase();
  const rows = p.entries.filter((e) => {
    if (actor && e.performedBy !== actor) return false;
    if (action && e.action !== action) return false;
    if (entityType && e.entityType !== entityType) return false;
    if (date && e.createdAt.slice(0, 10) !== date) return false;
    if (q && ![auditActor(e, p.who), auditTarget(e, p.labels).label, auditVerb(e), e.entityId].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
  const cols: Column<AuditLog>[] = [
    { key: "when", head: "When", kind: "muted", width: "170px", cell: (e) => formatDateTime(e.createdAt) },
    { key: "story", head: "What happened", width: "minmax(0, 1fr)", cell: (e) => {
      const target = auditTarget(e, p.labels);
      return <span><strong>{auditActor(e, p.who)}</strong> <span className="ax-sub" style={{ display: "inline" }}>({e.metadata?.automatic ? "automatic" : statusLabel(e.performedByRole)})</span> {auditVerb(e)} {target.href ? <Link href={target.href} onClick={(event) => event.stopPropagation()}>{target.label}</Link> : target.label}.<span className="ax-sub">{String(e.after?.reason ?? e.after?.rejectionReason ?? "")}</span></span>;
    } },
  ];
  if (p.error) return <div className="ax-panel ax-empty" role="alert"><p className="ax-title">Records unavailable</p><p>{p.error}</p><button type="button" className="ax-button" onClick={() => window.location.reload()}>Retry</button></div>;
  if (p.loading) return <div className="ax-panel" role="status">Loading records...</div>;
  return (
    <div className="ax-page">
      <PageHead eyebrow="Office" title="Audit log" kpis={[{ value: p.entries.length, label: "Entries" }]} />
      <p className="ax-note" style={{ marginTop: 0 }}>Every change to bookings, jobs, money and access is written here. Entries can&apos;t be edited or deleted.</p>
      <Toolbar count={{ shown: rows.length, total: p.entries.length }}>
        <input className="ax-search" type="search" aria-label="Search audit entries" placeholder="Search person, plate, customer or record" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Actor">
          <option value="">Everyone</option>
          {actors.map((id) => <option key={id} value={id}>{p.who[id] || p.entries.find((e) => e.performedBy === id)?.performedByName || `Account ${id.slice(0, 8)}`}</option>)}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{auditVerb({ action: a } as AuditLog)}</option>)}
        </select>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)} aria-label="Record type">
          <option value="">All records</option>
          {types.map((t) => <option key={t} value={t}>{statusLabel(t)}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
      </Toolbar>
      <ListPane
        rows={rows}
        columns={cols}
        loading={p.loading}
        error={p.error}
        onOpen={setSelected}
        empty={p.entries.length ? { title: "Nothing matches these filters", body: "Clear a filter to see more." } : { title: "No entries yet", body: "Changes made by staff and the system will appear here." }}
      />
      {selected && (
        <Drawer eyebrow={formatDateTime(selected.createdAt)} title={`${auditActor(selected, p.who)} ${auditVerb(selected)} ${auditTarget(selected, p.labels).label}`} onClose={() => setSelected(null)}>
          <div className="kv"><span>Record</span><span>{statusLabel(selected.entityType)} · <span className="ax-data">{selected.entityId}</span></span></div>
          <div className="kv"><span>By</span><span>{auditActor(selected, p.who)} ({statusLabel(selected.performedByRole)})</span></div>
          <div className="kv"><span>Studio</span><span>{selected.studioId ?? "Whole business"}</span></div>
          <p className="ax-label" style={{ marginTop: 20 }}>Before</p>
          <pre className="ax-code">{selected.before ? JSON.stringify(selected.before, null, 2) : "Nothing (new record)"}</pre>
          <p className="ax-label">After</p>
          <pre className="ax-code">{selected.after ? JSON.stringify(selected.after, null, 2) : "Nothing (removed)"}</pre>
        </Drawer>
      )}
    </div>
  );
}
