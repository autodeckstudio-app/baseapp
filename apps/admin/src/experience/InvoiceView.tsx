"use client";

// Invoice: reads like the document the customer receives, with payment and
// actions beside it. Printing hides the chrome and prints just the document.
import { useState } from "react";
import type { Customer, Invoice, Payment, Vehicle } from "@autodeck/core";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatPaise } from "../lib/format";
import { methodLabel } from "../lib/status-label";

export function InvoiceView(p: {
  invoice: Invoice;
  customer: Customer | null;
  vehicle: Vehicle | null;
  payment: Payment | null;
  studioName: string;
  message: string | null;
  voiding: boolean;
  onVoid: (reason: string) => void;
  onBack: () => void;
  onOpen: (href: string) => void;
}) {
  const inv = p.invoice;
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="ad-page">
      <button type="button" className="ad-back ad-noprint" onClick={p.onBack} style={{ background: "none", border: "none", padding: 0, minHeight: 0 }}>‹ Invoices</button>
      {p.message && <p className="ad-status-msg ad-noprint">{p.message}</p>}
      <div className="ad-detail" style={{ marginTop: 16 }}>
        <article className="ad-panel ad-invoice ad-detail-main">
          <header className="ad-invoice-head">
            <div>
              <p className="ad-invoice-brand">Auto<span>Deck</span></p>
              <p className="ad-sub">{p.studioName}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="ad-label" style={{ margin: 0 }}>Tax invoice</p>
              <p className="ad-data" style={{ fontSize: 18, margin: "4px 0" }}>{inv.invoiceNumber || "Draft"}</p>
              <StatusBadge label={inv.status} />
            </div>
          </header>
          <div className="ad-invoice-meta">
            <div><span className="ad-label">Billed to</span><p>{p.customer?.name ?? "Customer"}</p><span className="ad-sub">{p.customer?.phone}</span></div>
            <div><span className="ad-label">Car</span><p className="ad-data">{p.vehicle?.registrationNumber ?? "—"}</p><span className="ad-sub">{[p.vehicle?.make, p.vehicle?.model].filter(Boolean).join(" ")}</span></div>
            <div><span className="ad-label">Issued</span><p>{formatDateTime(inv.issuedAt)}</p></div>
          </div>
          <div className="ad-invoice-lines" role="table">
            <div className="ad-invoice-line is-head" role="row"><span>Item</span><span>Qty</span><span>Rate</span><span>Amount</span></div>
            {inv.lineItems.map((li, i) => (
              <div key={i} className="ad-invoice-line" role="row"><span>{li.description}</span><span>{li.quantity}</span><span className="ad-data">{formatPaise(li.unitPrice)}</span><span className="ad-data">{formatPaise(li.total)}</span></div>
            ))}
          </div>
          <div className="ad-invoice-totals">
            <div className="kv"><span>Subtotal</span><span className="ad-data">{formatPaise(inv.subtotal)}</span></div>
            <div className="kv"><span>{inv.taxDescription}</span><span className="ad-data">{formatPaise(inv.tax)}</span></div>
            <div className="kv ad-invoice-grand"><span>Total</span><span>{formatPaise(inv.total)}</span></div>
          </div>
          {inv.status === "void" && <p className="ad-note" style={{ color: "var(--ad-danger)" }}>Voided {formatDateTime(inv.voidedAt)}{inv.voidedReason ? ` · ${inv.voidedReason}` : ""}</p>}
        </article>

        <aside className="ad-detail-side ad-noprint">
          <section className="ad-panel">
            <span className="ad-label">Payment</span>
            {p.payment ? (
              <>
                <div className="kv"><span>Status</span><StatusBadge label={p.payment.status} /></div>
                <div className="kv"><span>Method</span><span>{methodLabel(p.payment.method)}</span></div>
                <div className="kv"><span>Amount</span><span className="ad-data">{formatPaise(p.payment.amount)}</span></div>
              </>
            ) : <p className="ad-note" style={{ marginTop: 0 }}>Not paid yet.</p>}
          </section>
          <section className="ad-panel">
            <span className="ad-label">Actions</span>
            <div className="ad-panel-actions" style={{ marginTop: 0 }}>
              <button type="button" className="ad-button ad-button--primary" onClick={() => window.print()}>Print</button>
              <button type="button" className="ad-button" onClick={() => p.onOpen(`/jobs/${inv.jobId}`)}>Open job</button>
              {inv.bookingId && <button type="button" className="ad-button" onClick={() => p.onOpen(`/bookings/${inv.bookingId}`)}>Open booking</button>}
            </div>
          </section>
          {inv.status !== "void" && (
            <section className="ad-panel">
              <span className="ad-label">Void</span>
              {inv.status === "paid" ? (
                <p className="ad-note" style={{ marginTop: 0 }}>A paid invoice can&apos;t be voided. Refund the payment first.</p>
              ) : confirming ? (
                <form onSubmit={(e) => { e.preventDefault(); if (reason.trim()) p.onVoid(reason.trim()); }}>
                  <label className="ad-form-row"><span>Why is it being voided?</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                  <div className="ad-panel-actions">
                    <button type="submit" className="ad-button ad-button--danger" disabled={p.voiding || !reason.trim()}>{p.voiding ? "Voiding" : "Void invoice"}</button>
                    <button type="button" className="ad-button" onClick={() => setConfirming(false)}>Keep</button>
                  </div>
                </form>
              ) : (
                <button type="button" className="ad-button" onClick={() => setConfirming(true)}>Void this invoice</button>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
