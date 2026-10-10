"use client";

// Invoice: reads like the document the customer receives, with payment and
// actions beside it. Printing hides the chrome and prints just the document.
import { buildInvoiceHtml, printInvoiceHtml } from "@autodeck/ui/invoice";
import { useEffect, useState } from "react";
import { type Customer, type Invoice, type Payment, type Vehicle } from "@autodeck/core";
import { getServicesIncludingHidden } from "../lib/catalogue-service";
import { StatusBadge } from "../components/StatusBadge";
import { formatPaise } from "../lib/format";
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
  const [catalogue, setCatalogue] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    void getServicesIncludingHidden().then((services) => { if (alive) setCatalogue(Object.fromEntries(services.map((s) => [s.id, s.name]))); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const snapshots = inv as unknown as { customerSnapshot?: Customer; vehicleSnapshot?: Vehicle };
  const customer = snapshots.customerSnapshot ?? p.customer;
  const vehicle = snapshots.vehicleSnapshot ?? p.vehicle;
  const html = buildInvoiceHtml({
    invoice: inv,
    catalogue,
    studio: { name: p.studioName, address: "Sunbeam Complex, Old Sharda Mandir Rd, Ellisbridge, Ahmedabad, Gujarat 380006", phone: "+919898679711" },
    customer: customer ?? null,
    vehicle: vehicle ? { make: vehicle.make, model: vehicle.model, registrationNumber: vehicle.registrationNumber } : null,
    appearance: "print",
  });
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="ax-page">
      <button type="button" className="ax-back ax-noprint" onClick={p.onBack} style={{ background: "none", border: "none", padding: 0, minHeight: 0 }}>‹ Invoices</button>
      {p.message && <p className="ax-status-msg ax-noprint">{p.message}</p>}
      <div className="ax-detail" style={{ marginTop: 16 }}>
        <div className="ax-detail-main ax-invoice-doc">
          <iframe title="Invoice" srcDoc={html} scrolling="no" onLoad={(e) => {
            const d = e.currentTarget.contentDocument;
            if (d) e.currentTarget.style.height = `${Math.ceil(d.body.scrollHeight)}px`;
          }} style={{ display: "block", width: "100%", maxWidth: 794, height: 1100, border: 0, borderRadius: 18, margin: "0 auto", background: "#f8f6f0" }} />
        </div>

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
              <button type="button" className="ax-button ax-button--primary" onClick={() => printInvoiceHtml(html)}>Print</button>
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
