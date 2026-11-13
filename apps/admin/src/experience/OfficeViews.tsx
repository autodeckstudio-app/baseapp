"use client";

// Presentational office lists. Pages own data and actions; these own the
// look, so the /design previews render exactly what staff see.
import { customerMatches, plateIndex } from "../lib/customer-search";
import Link from "next/link";
import { auditActor, auditTarget, auditVerb } from "../lib/audit-display";
import{JobSummaryIcon}from"../components/JobSummaryIcon";
import { useState } from "react";
import type { AuditLog, Customer, Invoice, InvoiceStatus, Payment, PaymentStatus, ServiceJob } from "@autodeck/core";
import { PageHead, Toolbar, Segmented, ListPane, Drawer, type Column } from "./Office";
import { StatusBadge } from "../components/StatusBadge";
import { formatPaise, formatDate, formatDateTime, studioToday } from "../lib/format";
import { methodLabel, statusLabel } from "../lib/status-label";
import type { RefundWork } from "../lib/refund-work-service";

type Names = Record<string, string>;

/* ---------------- Customers ---------------- */

export function CustomersView(p: {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearch: (q: string) => void;
  vehicles?: { ownerId: string; registrationNumber?: string }[];
  jobs?: Pick<ServiceJob, "customerId" | "createdAt" | "status" | "paymentStatus" | "totalAmount">[] | undefined;
  onPlateLookup: (plate: string) => void;
  plateMessage: string | null;
  onOpen: (id: string) => void;
}) {
  const q = p.search.trim().toLowerCase();
  const plates = plateIndex(p.vehicles ?? []);
  const rows = q ? p.customers.filter((c) => customerMatches(c, p.search, plates)) : p.customers;
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const newThisMonth = p.customers.filter((c) => c.createdAt >= monthAgo).length;
  // Per-customer facts staff actually need: cars, visits, last visit, money to collect.
  const stats = new Map<string, { visits: number; last: string; due: number; partial: boolean }>();
  for (const j of p.jobs ?? []) {
    if (j.status === "CANCELLED") continue;
    const st = stats.get(j.customerId) ?? { visits: 0, last: "", due: 0, partial: false };
    st.visits += 1;
    if (j.createdAt > st.last) st.last = j.createdAt;
    if (j.status === "DELIVERED" && j.paymentStatus === "unpaid") st.due += j.totalAmount;
    if (j.status === "DELIVERED" && j.paymentStatus === "partial") st.partial = true;
    stats.set(j.customerId, st);
  }
  const carsOf = new Map<string, string[]>();
  for (const v of p.vehicles ?? []) {
    if (!v.registrationNumber) continue;
    carsOf.set(v.ownerId, [...(carsOf.get(v.ownerId) ?? []), v.registrationNumber]);
  }
  const haveJobs = p.jobs !== undefined;
  const cols: Column<Customer>[] = [
    { key: "name", head: "Customer", kind: "strong", width: "minmax(0, 1.7fr)", cell: (c) => (
      <span className="ax-cust-cell"><span className="ax-cust-name">{c.name || "Unnamed customer"}</span><span className="ax-cust-sub">{c.phone || "No phone"}</span></span>
    ) },
    { key: "cars", head: "Cars", kind: "data", width: "minmax(0, 1.9fr)", cell: (c) => {
      const cars = carsOf.get(c.id) ?? [];
      if (cars.length === 0) return <span className="ax-cust-sub">None added</span>;
      return <span className="ax-cust-cars">{cars.slice(0, 2).map((r) => <span key={r} className="ax-plate-chip">{r}</span>)}{cars.length > 2 ? <span className="ax-cust-sub">+{cars.length - 2}</span> : null}</span>;
    } },
    ...(haveJobs ? [
      { key: "visits", head: "Visits", kind: "data" as const, width: "minmax(0, .6fr)", align: "center" as const, cell: (c: Customer) => stats.get(c.id)?.visits ?? 0 },
      { key: "last", head: "Last visit", kind: "muted" as const, align: "center" as const, width: "minmax(0, 1fr)", cell: (c: Customer) => { const l = stats.get(c.id)?.last; return l ? formatDate(l) : "Never"; } },
      { key: "due", head: "To collect", kind: "data" as const, width: "minmax(0, 1fr)", align: "end" as const, cell: (c: Customer) => {
        const st = stats.get(c.id);
        if (st && st.due > 0) return <span className="ax-due">{formatPaise(st.due)}</span>;
        return st?.partial ? <span className="ax-cust-sub">Part paid</span> : <span className="ax-cust-sub">Clear</span>;
      } },
    ] : []),
  ];
  const owing = Array.from(stats.values()).filter((x) => x.due > 0).length;
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
          ...(haveJobs ? [{ value: owing, label: "Owe money", tone: "accent" as const }] : []),
        ]}
      />
      <Toolbar count={{ shown: rows.length, total: p.customers.length }}>
        <input className="ax-search" type="search" aria-label="Search customers by name, phone, email or number plate" placeholder="Name, phone, email or plate" value={p.search} onChange={(e) => p.onSearch(e.target.value)} />
        <PlateLookup onLookup={p.onPlateLookup} />
      </Toolbar>
      {p.plateMessage && <p className="ax-status-msg ax-status-msg--warn">{p.plateMessage}</p>}
      <ListPane
        rows={rows}
        columns={cols}
        loading={p.loading}
        error={p.error}
        onOpen={(c) => p.onOpen(c.id)}
        empty={q ? { title: "No one matches that", body: "Try part of the name, the phone number, the email or the number plate." } : { title: "No customers yet", body: "Customers appear here after their first booking or sign-in." }}
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
  invoiceNos?: Names;
  loading: boolean;
  error: string | null;
  status: PaymentStatus | "";
  onStatus: (s: PaymentStatus | "") => void;
  search: string;
  onSearch: (q: string) => void;
  message: string | null;
  refundingId: string | null;
  onRefund: (id: string, reason: string) => void;
  confirmingId: string | null;
  onConfirmReceived: (payment: Payment) => void;
  onOpenInvoice: (id: string) => void;
  today: string;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [ackId, setAckId] = useState<string | null>(null);
  const q = p.search.trim().toLowerCase();
  const rows = p.payments.filter((x) => {
    if (p.status === "pending" ? !(x.status === "pending" || x.status === "processing") : p.status && x.status !== p.status) return false;
    if (!q) return true;
    return [x.id, x.customerId, x.jobId, x.bookingId, p.names[x.customerId], x.invoiceId ? p.invoiceNos?.[x.invoiceId] : ""].filter(Boolean).join(" ").toLowerCase().includes(q);
  });
  const done = p.payments.filter((x) => x.status === "completed");
  const takenToday = done.filter((x) => studioToday(new Date(x.createdAt)) === p.today).reduce((s, x) => s + x.amount, 0);
  const waiting = p.payments.filter((x) => x.status === "pending" || x.status === "processing").length;
  const failed = p.payments.filter((x) => x.status === "failed").length;

  const cols: Column<Payment>[] = [
    { key: "when", head: "When", kind: "muted", width: "142px", cell: (x) => formatDateTime(x.createdAt) },
    { key: "who", head: "Customer", kind: "strong", width: "minmax(96px, 1.6fr)", cell: (x) => p.names[x.customerId] ?? "Customer" },
    { key: "inv", head: "Invoice", kind: "data", width: "minmax(84px, 1fr)", cell: (x) => (x.invoiceId ? (p.invoiceNos?.[x.invoiceId] || "Invoice") : "-") },
    { key: "how", head: "Method", width: "66px", cell: (x) => methodLabel(x.method) },
    { key: "status", head: "Status", width: "104px", cell: (x) => x.externalReturnRecordId ? <span className="badge badge-neutral" style={{ whiteSpace: "normal" }} title="External return recorded">External return recorded</span> : <StatusBadge label={x.status} /> },
    { key: "amt", head: "Amount", kind: "data", align: "end", width: "72px", cell: (x) => formatPaise(x.amount) },
    {
      key: "act",
      head: "",
      align: "end",
      width: "160px",
      cell: (x) => (
        <span className="ax-row-actions">
          {x.invoiceId && <button type="button" className="ax-button" onClick={() => p.onOpenInvoice(x.invoiceId ?? "")}>Invoice</button>}
          {(x.status === "pending" || x.status === "processing") && x.method === "upi_manual" && (ackId === x.id ? (
            <span className="ax-confirm-panel">
              <span className="ax-confirm-q">Money seen in the account?</span>
              <span className="ax-confirm-buttons">
                <button type="button" className="ax-button" disabled={p.confirmingId === x.id} onClick={() => { p.onConfirmReceived(x); setAckId(null); }}>
                  {p.confirmingId === x.id ? "Confirming" : "Yes, confirm received"}
                </button>
                <button type="button" className="ax-button" onClick={() => setAckId(null)}>Not yet</button>
              </span>
            </span>
          ) : (
            <button type="button" className="ax-button" onClick={() => setAckId(x.id)}>Confirm received</button>
          ))}
          {x.status === "completed" && !x.externalReturnRecordId && (confirmId === x.id ? (
            <span className="ax-confirm-panel">
              <input placeholder="Reason for refund" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Refund reason" />
              <span className="ax-confirm-buttons">
                <button type="button" className="ax-button ax-button--danger" disabled={p.refundingId === x.id || !reason.trim()} onClick={() => p.onRefund(x.id, reason.trim())}>
                  {p.refundingId === x.id ? "Refunding" : "Refund"}
                </button>
                <button type="button" className="ax-button" onClick={() => { setConfirmId(null); setReason(""); }}>Keep</button>
              </span>
            </span>
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
          { value: formatPaise(takenToday), label: "Taken today (loaded)", tone: "premium" },
          { value: waiting, label: "Awaiting confirmation (loaded)", tone: waiting ? "accent" : undefined },
          { value: failed, label: "Failed (loaded)", tone: failed ? "danger" : undefined },
        ]}
      />
      <Toolbar count={{ shown: rows.length, total: p.payments.length }}>
        <Segmented value={p.status} options={PAYMENT_FILTERS} onChange={p.onStatus} />
        <input className="ax-search" type="search" aria-label="Search payments" placeholder="Search customer, job or booking" value={p.search} onChange={(e) => p.onSearch(e.target.value)} />
      </Toolbar>
      {p.message && <p className="ax-status-msg">{p.message}</p>}
      {p.payments.some((x)=>x.externalReturnRecordId)&&<section className="ax-panel ax-return-note" role="note"><div className="ax-return-title"><JobSummaryIcon name="payments"/><strong>Returned outside Razorpay</strong><StatusBadge label="Reported by owner"/></div><span className="ax-return-guard"><JobSummaryIcon name="shield"/>Check return before refunding</span><details><summary>Details</summary><p className="ax-note">Linked payments share one return record; no individual split is recorded. Provider capture and refund amounts are unchanged. Further provider refunds are blocked pending reconciliation.</p></details></section>}
      <ListPane
        rows={rows}
        columns={cols}
        loading={p.loading}
        error={p.error}
        empty={p.payments.length ? { title: "Nothing matches these filters", body: "Clear the search or pick a different status." } : { title: "No payments in this loaded view", body: "This is a bounded live feed, not a complete payment history." }}
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
  const cols: Column<Invoice>[] = [
    { key: "no", head: "Invoice", kind: "data", width: "minmax(0, 1.1fr)", cell: (i) => i.invoiceNumber || "Draft" },
    { key: "who", head: "Customer", kind: "strong", width: "minmax(0, 1.6fr)", cell: (i) => p.names[i.customerId] ?? "Customer" },
    { key: "status", head: "Status", width: "110px", cell: (i) => <StatusBadge label={i.status} /> },
    { key: "issued", head: "Issued", kind: "muted", width: "150px", cell: (i) => formatDateTime(i.issuedAt) },
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
        listClassName="ax-list--invoices"
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
      return <span style={{ whiteSpace: "normal", overflowWrap: "anywhere", display: "block", padding: "12px 0" }}><strong>{auditActor(e, p.who)}</strong> <span className="ax-sub" style={{ display: "inline" }}>({e.metadata?.automatic ? "automatic" : statusLabel(e.performedByRole)})</span> {auditVerb(e)} {target.href ? <Link href={target.href} onClick={(event) => event.stopPropagation()}>{target.label}</Link> : target.label}.<span className="ax-sub">{String(e.after?.reason ?? e.after?.rejectionReason ?? "")}</span></span>;
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


/* ---------------- Refund recovery work ---------------- */

const REFUND_STATUS_LABEL:Record<string,string>={reserved:"Ready to send",submitting:"Sending",submitted:"Sent to Razorpay",accepted:"Accepted by Razorpay",ambiguous:"Needs checking",failed:"On hold"};
export function RefundWorkPanel(p:{work:RefundWork|null;loading:boolean;error:string|null;running:boolean;reconciling?:boolean;actionsEnabled:boolean;names?:Names;onRun:()=>void;onReconcile?:()=>void;onContinueScan?:()=>void;onOpenInvoice:(id:string)=>void}){
 const[confirmSend,setConfirmSend]=useState(false);
 if(p.error)return <div className="ax-panel" role="alert"><strong>Can't load refunds</strong><p>{p.error}</p></div>;
 if(p.loading||!p.work)return <div className="ax-panel" role="status">Checking refunds…</div>;
 const{requests,reviewPayments,legacyClaims,legacyScanComplete}=p.work;
 if(!requests.length&&!reviewPayments.length&&!legacyClaims.length&&legacyScanComplete)return null;
 const count=requests.length+reviewPayments.length+legacyClaims.length;
 return <section className="ax-panel ax-rw ax-rw-simple" aria-label="Refunds"><header className="ax-rw-simple-head"><div className="ax-return-title"><JobSummaryIcon name="payments"/><strong>Refunds</strong><span className="ax-muted">{count}{legacyScanComplete?'':'+'} to review</span></div>{legacyClaims.length>0&&p.onReconcile?<button type="button" className="ax-button" disabled={p.reconciling||!p.actionsEnabled} onClick={p.onReconcile}>{p.reconciling?'Checking…':'Check status'}</button>:null}</header>
 {requests.map(r=><div key={r.id} className="ax-rw-row"><div><strong>{(r.amountPaise===null||r.amountPaise===undefined)?'-':formatPaise(r.amountPaise)}</strong> <StatusBadge label={REFUND_STATUS_LABEL[r.status]??'Needs checking'}/></div><div className="ax-row-actions">{r.bookingId?<Link className="ax-button" href={`/bookings/${r.bookingId}`}>Booking</Link>:r.jobId?<Link className="ax-button" href={`/jobs/${r.jobId}`}>Job</Link>:null}<details className="ax-rw-details"><summary>Details</summary><span>{r.updatedAt?formatDateTime(r.updatedAt):''}</span>{r.lastError?<p>{r.lastError}</p>:null}{r.providerRefundId?<p>{r.providerRefundId}</p>:null}</details></div></div>)}
 {legacyClaims.map(c=><div key={c.paymentId} className="ax-rw-row"><div><strong>{(c.amount===null||c.amount===undefined)?'-':formatPaise(c.amount)}</strong> <StatusBadge label={c.reconcileState==='held'?'On hold':'Check refund record'}/></div><div className="ax-row-actions"><Link className="ax-button" href={`/payments?search=${c.paymentId}`}>Payment</Link><details className="ax-rw-details"><summary>Details</summary><p>Payment status: {statusLabel(c.paymentStatus??'unknown')}</p><p>{c.claimedAt?formatDateTime(c.claimedAt):''}</p>{c.reconcileNote?<p>{c.reconcileNote}</p>:null}<p>Checks provider status; never submits a new refund.</p></details></div></div>)}
 {reviewPayments.map(x=><div key={x.id} className="ax-rw-row"><div><strong>{(x.refundAmount===null||x.refundAmount===undefined)?'-':formatPaise(x.refundAmount)}</strong> <StatusBadge label="Check invoice"/></div><div className="ax-row-actions">{x.invoiceId?<button type="button" className="ax-button" onClick={()=>p.onOpenInvoice(x.invoiceId??'')}>Invoice</button>:<Link className="ax-button" href={`/payments?search=${x.id}`}>Payment</Link>}<details className="ax-rw-details"><summary>Details</summary><p>{(x.amount===null||x.amount===undefined)?'':`${formatPaise(x.amount)} captured`}</p><p>{x.customerId?p.names?.[x.customerId]??'Customer':''}</p><p>{x.invoiceId?'Linked invoice needs review.':'No linked invoice. Check the payment record.'}</p></details></div></div>)}
 {!legacyScanComplete&&p.onContinueScan?<button type="button" className="ax-button" disabled={p.reconciling} onClick={p.onContinueScan}>Load older records</button>:null}
 {requests.length>0?<div className="ax-rw-send">{confirmSend?<div className="ax-confirm-panel"><span>Send reserved refunds to Razorpay?</span><div className="ax-confirm-buttons"><button type="button" className="ax-button ax-button--danger" disabled={p.running||!p.actionsEnabled} onClick={()=>{setConfirmSend(false);p.onRun()}}>Confirm send refunds</button><button type="button" className="ax-button" onClick={()=>setConfirmSend(false)}>Go back</button></div></div>:<button type="button" className="ax-button" disabled={p.running||!p.actionsEnabled} onClick={()=>setConfirmSend(true)}>{p.running?'Sending…':'Send ready refunds'}</button>}</div>:null}
 {!p.actionsEnabled?<span className="ax-muted">Refund actions unavailable</span>:null}
 </section>;
}
