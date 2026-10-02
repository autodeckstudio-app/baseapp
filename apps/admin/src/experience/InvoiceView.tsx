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
    <div className="ax-page">
      <button type="button" className="ax-back ax-noprint" onClick={p.onBack} style={{ background: "none", border: "none", padding: 0, minHeight: 0 }}>‹ Invoices</button>
      {p.message && <p className="ax-status-msg ax-noprint">{p.message}</p>}
      <div className="ax-detail" style={{ marginTop: 16 }}>
        <article className="ax-panel ax-invoice ax-detail-main">
          <header className="ax-invoice-head">
            <div>
              <p className="ax-invoice-brand">Auto<span>Deck</span></p>
              <p className="ax-sub">{p.studioName}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="ax-label" style={{ margin: 0 }}>Tax invoice</p>
              <p className="ax-data" style={{ fontSize: 18, margin: "4px 0" }}>{inv.invoiceNumber || "Draft"}</p>
              <StatusBadge label={inv.status} />
            </div>
          </header>
          <div className="ax-invoice-meta">
            <div><span className="ax-label">Billed to</span><p>{p.customer?.name ?? "Customer"}</p><span className="ax-sub">{p.customer?.phone}</span></div>
            <div><span className="ax-label">Car</span><p className="ax-data">{p.vehicle?.registrationNumber ?? "-"}</p><span className="ax-sub">{[p.vehicle?.make, p.vehicle?.model].filter(Boolean).join(" ")}</span></div>
            <div><span className="ax-label">Issued</span><p>{formatDateTime(inv.issuedAt)}</p></div>
          </div>
          <div className="ax-invoice-lines" role="table">
            <div className="ax-invoice-line is-head" role="row"><span>Item</span><span>Qty</span><span>Rate</span><span>Amount</span></div>
            {inv.lineItems.map((li, i) => (
              <div key={i} className="ax-invoice-line" role="row"><span>{li.description}</span><span>{li.quantity}</span><span className="ax-data">{formatPaise(li.unitPrice)}</span><span className="ax-data">{formatPaise(li.total)}</span></div>
            ))}
          </div>
          <div className="ax-invoice-totals">
            <div className="kv"><span>Subtotal</span><span className="ax-data">{formatPaise(inv.subtotal)}</span></div>
            <div className="kv"><span>{inv.taxDescription}</span><span className="ax-data">{formatPaise(inv.tax)}</span></div>
            <div className="kv ax-invoice-grand"><span>Total</span><span>{formatPaise(inv.total)}</span></div>
          </div>
          {inv.status === "void" && <p className="ax-note" style={{ color: "var(--ad-danger)" }}>Voided {formatDateTime(inv.voidedAt)}{inv.voidedReason ? ` · ${inv.voidedReason}` : ""}</p>}
        </article>

        <aside className="ax-detail-side ax-noprint">
          <section className="ax-panel">
            <span className="ax-label">Payment</span>
            {p.payment ? (
              <>
                <div className="kv"><span>Status</span><StatusBadge label={p.payment.status} /></div>
                <div className="kv"><span>Method</span><span>{methodLabel(p.payment.method)}</span></div>
                <div className="kv"><span>Amount</span><span className="ax-data">{formatPaise(p.payment.amount)}</span></div>
              </>
            ) : <p className="ax-note" style={{ marginTop: 0 }}>Not paid yet.</p>}
          </section>
          <section className="ax-panel">
            <span className="ax-label">Actions</span>
            <div className="ax-panel-actions" style={{ marginTop: 0 }}>
              <button type="button" className="ax-button ax-button--primary" onClick={() => window.print()}>Print</button>
              <button type="button" className="ax-button" onClick={() => p.onOpen(`/jobs/${inv.jobId}`)}>Open job</button>
              {inv.bookingId && <button type="button" className="ax-button" onClick={() => p.onOpen(`/bookings/${inv.bookingId}`)}>Open booking</button>}
            </div>
          </section>
          {inv.status !== "void" && (
            <section className="ax-panel">
              <span className="ax-label">Void</span>
              {inv.status === "paid" ? (
                <p className="ax-note" style={{ marginTop: 0 }}>A paid invoice can&apos;t be voided. Refund the payment first.</p>
              ) : confirming ? (
                <form onSubmit={(e) => { e.preventDefault(); if (reason.trim()) p.onVoid(reason.trim()); }}>
                  <label className="ax-form-row"><span>Why is it being voided?</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                  <div className="ax-panel-actions">
                    <button type="submit" className="ax-button ax-button--danger" disabled={p.voiding || !reason.trim()}>{p.voiding ? "Voiding" : "Void invoice"}</button>
                    <button type="button" className="ax-button" onClick={() => setConfirming(false)}>Keep</button>
                  </div>
                </form>
              ) : (
                <button type="button" className="ax-button" onClick={() => setConfirming(true)}>Void this invoice</button>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
