"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Invoice, Customer, Vehicle, Payment } from "@autodeck/core";
import { useAdminAuth } from "../../../../lib/auth-context";
import { listenToInvoice, voidInvoice } from "../../../../lib/invoices-service";
import { getCustomer, getVehicle } from "../../../../lib/bookings-service";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { COLLECTIONS } from "@autodeck/database";
import { StatusBadge } from "../../../../components/StatusBadge";
import { formatPaise, formatDateTime } from "../../../../lib/format";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { claims } = useAdminAuth();

  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    return listenToInvoice(id, setInvoice, (err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!invoice) return undefined;
    void getCustomer(invoice.customerId).then(setCustomer);
    void getVehicle(invoice.vehicleId).then(setVehicle);
    if (!claims || !invoice.paymentId) return undefined;
    const q = query(collection(db, COLLECTIONS.payments()), where("tenantId", "==", claims.tenantId), where("invoiceId", "==", invoice.id));
    return onSnapshot(q, (snap) => setPayment(snap.empty ? null : (snap.docs[0]?.data() as Payment)), (err) => setError(err.message));
  }, [invoice, claims]);

  async function handleVoid() {
    if (!invoice) return;
    setVoiding(true);
    setStatus(null);
    try {
      await voidInvoice(invoice.id, reason);
      setStatus("Invoice voided.");
      setConfirming(false);
      setReason("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to void invoice.");
    } finally {
      setVoiding(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (invoice === undefined) return <p>Loading…</p>;
  if (invoice === null) return <p>Invoice not found.</p>;

  const showVoidCard = invoice.status !== "void";

  return (
    <div>
      <button onClick={() => router.push("/invoices")}>&larr; Invoices</button>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {invoice.invoiceNumber}
        <StatusBadge label={invoice.status} />
      </h1>
      {status && <p>{status}</p>}

      <div className="detail-grid">
        <div className="detail-card">
          <h3>Customer &amp; Vehicle</h3>
          <div className="kv"><span>Customer</span><span>{customer?.name ?? invoice.customerId}</span></div>
          <div className="kv"><span>Vehicle</span><span>{vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}` : invoice.vehicleId}</span></div>
          <button onClick={() => router.push(`/jobs/${invoice.jobId}`)}>Open job</button>
          {invoice.bookingId && <button onClick={() => router.push(`/bookings/${invoice.bookingId}`)}>Open booking</button>}
        </div>

        <div className="detail-card">
          <h3>Payment</h3>
          {payment ? (
            <>
              <div className="kv"><span>Status</span><span><StatusBadge label={payment.status} /></span></div>
              <div className="kv"><span>Method</span><span>{payment.method}</span></div>
              <div className="kv"><span>Amount</span><span>{formatPaise(payment.amount)}</span></div>
            </>
          ) : (
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13 }}>No linked payment.</p>
          )}
        </div>

        <div className="detail-card">
          <h3>Dates</h3>
          <div className="kv"><span>Issued</span><span>{formatDateTime(invoice.issuedAt)}</span></div>
          {invoice.voidedAt && <div className="kv"><span>Voided</span><span>{formatDateTime(invoice.voidedAt)}</span></div>}
          {invoice.voidedReason && <div className="kv"><span>Reason</span><span>{invoice.voidedReason}</span></div>}
        </div>
      </div>

      <h2>Price breakdown</h2>
      <div className="detail-card" style={{ maxWidth: 480, marginBottom: 24 }}>
        <table>
          <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
          <tbody>
            {invoice.lineItems.map((li, i) => (
              <tr key={i}>
                <td>{li.description}</td>
                <td>{li.quantity}</td>
                <td>{formatPaise(li.unitPrice)}</td>
                <td>{formatPaise(li.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="kv" style={{ marginTop: 8 }}><span>Subtotal</span><span>{formatPaise(invoice.subtotal)}</span></div>
        <div className="kv"><span>{invoice.taxDescription}</span><span>{formatPaise(invoice.tax)}</span></div>
        <div className="kv"><span><strong>Total</strong></span><span><strong>{formatPaise(invoice.total)}</strong></span></div>
      </div>

      {showVoidCard && (
        <div className="detail-card" style={{ maxWidth: 420 }}>
          <h3>Void invoice</h3>
          {invoice.status === "paid" ? (
            <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Cannot void a paid invoice — initiate a refund from the Payments page first.</p>
          ) : confirming ? (
            <>
              <fieldset>
                <label>
                  Reason
                  <br />
                  <input value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
              </fieldset>
              <button onClick={() => void handleVoid()} disabled={voiding || !reason.trim()}>
                {voiding ? "Voiding…" : "Confirm void"}
              </button>{" "}
              <button onClick={() => setConfirming(false)}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)}>Void invoice</button>
          )}
        </div>
      )}
    </div>
  );
}
