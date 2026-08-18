"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import type { ServiceJob, Payment, Invoice, ApprovalRequest, Warranty, AuditLog, Customer, Vehicle, Service, PaymentMethod } from "@autodeck/core";
import { functions } from "../../../../lib/firebase";
import { useAdminAuth } from "../../../../lib/auth-context";
import { listenToJob, getWarrantyForJob, listenToAuditForEntity } from "../../../../lib/jobs-service";
import { listenToApprovalsForJob, listenToPaymentForJob, listenToInvoiceForJob, getCustomer, getVehicle, getService } from "../../../../lib/bookings-service";
import { StatusBadge } from "../../../../components/StatusBadge";
import { formatPaise, formatDateTime } from "../../../../lib/format";

type RecordManualPaymentOutput = { paymentId: string; invoiceId: string };
type ConfirmManualPaymentOutput = { paymentId: string; invoiceId: string | null; alreadyCompleted: boolean };

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { claims } = useAdminAuth();

  const [job, setJob] = useState<ServiceJob | null | undefined>(undefined);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!id) return undefined;
    return listenToJob(id, setJob, (err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!job || !claims) return undefined;
    const unsubApprovals = listenToApprovalsForJob(job.id, claims.tenantId, setApprovals, (err) => setError(err.message));
    const unsubPayment = listenToPaymentForJob(job.id, claims.tenantId, setPayment, (err) => setError(err.message));
    const unsubInvoice = listenToInvoiceForJob(job.id, claims.tenantId, setInvoice, (err) => setError(err.message));
    const unsubAudit = listenToAuditForEntity(claims.tenantId, "ServiceJob", job.id, setAudit, (err) => setError(err.message));
    void getWarrantyForJob(job.id).then(setWarranty);
    return () => {
      unsubApprovals();
      unsubPayment();
      unsubInvoice();
      unsubAudit();
    };
  }, [job?.id, claims]);

  useEffect(() => {
    if (!job) return;
    void getCustomer(job.customerId).then(setCustomer);
    void getVehicle(job.vehicleId).then(setVehicle);
    void getService(job.serviceId).then(setService);
  }, [job]);

  async function handleRecordPayment() {
    if (!job) return;
    setStatus(null);
    setRecording(true);
    try {
      const fn = httpsCallable<{ jobId: string; method: PaymentMethod; manualReference?: string }, RecordManualPaymentOutput>(
        functions,
        "recordManualPayment",
      );
      await fn(reference ? { jobId: job.id, method, manualReference: reference } : { jobId: job.id, method });
      setStatus("Payment recorded and invoice issued.");
      setReference("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setRecording(false);
    }
  }

  async function handleConfirmCashPayment() {
    if (!payment) return;
    setStatus(null);
    setConfirming(true);
    try {
      const fn = httpsCallable<{ paymentId: string }, ConfirmManualPaymentOutput>(functions, "confirmManualPayment");
      await fn({ paymentId: payment.id });
      setStatus("Payment confirmed and invoice issued.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to confirm payment.");
    } finally {
      setConfirming(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (job === undefined) return <p>Loading…</p>;
  if (job === null) return <p>Job not found.</p>;

  return (
    <div>
      <button onClick={() => router.push("/jobs")}>&larr; Jobs</button>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        Job {job.id}
        <StatusBadge label={job.status} />
      </h1>

      <div className="detail-grid">
        <div className="detail-card">
          <h3>Customer &amp; Vehicle</h3>
          <div className="kv"><span>Customer</span><span>{customer?.name ?? job.customerId}</span></div>
          <div className="kv"><span>Vehicle</span><span>{vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}` : job.vehicleId}</span></div>
          <div className="kv"><span>Service</span><span>{service?.name ?? job.serviceId}</span></div>
          <div className="kv"><span>Source</span><span>{job.isWalkIn ? "Walk-in" : "Booking"}</span></div>
          {job.bookingId && <button onClick={() => router.push(`/bookings/${job.bookingId}`)}>Open booking</button>}
        </div>

        <div className="detail-card">
          <h3>Bay &amp; Schedule</h3>
          <div className="kv"><span>Bay</span><span>{job.bayId}</span></div>
          <div className="kv"><span>Scheduled</span><span>{formatDateTime(job.scheduledAt)}</span></div>
          <div className="kv"><span>Est. end</span><span>{formatDateTime(job.estimatedEndAt)}</span></div>
          <div className="kv"><span>Sealed</span><span>{job.sealedAt ? formatDateTime(job.sealedAt) : "—"}</span></div>
        </div>

        <div className="detail-card">
          <h3>Price</h3>
          <div className="kv"><span>Base total</span><span>{formatPaise(job.priceBreakdown.total)}</span></div>
          <div className="kv"><span>Additional work</span><span>{formatPaise(job.additionalWorkDelta)}</span></div>
          <div className="kv"><span>Current total</span><span><strong>{formatPaise(job.totalAmount)}</strong></span></div>
          <div className="kv"><span>Payment status</span><span><StatusBadge label={job.paymentStatus} /></span></div>
        </div>

        <div className="detail-card">
          <h3>Payment &amp; Invoice</h3>
          {payment ? (
            <>
              <div className="kv"><span>Payment</span><span><StatusBadge label={payment.status} /> · {payment.method}</span></div>
              <div className="kv"><span>Amount</span><span>{formatPaise(payment.amount)}</span></div>
              {(payment.status === "pending" || payment.status === "processing") &&
                (payment.method === "razorpay_payment_link" ? (
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Awaiting online payment confirmation from the payment provider.</p>
                ) : (
                  <button onClick={() => void handleConfirmCashPayment()} disabled={confirming} style={{ marginTop: 8 }}>
                    {confirming ? "Confirming…" : "Confirm cash received"}
                  </button>
                ))}
            </>
          ) : (
            <p style={{ margin: "0 0 8px", color: "var(--color-text-muted)", fontSize: 13 }}>No payment initiated yet.</p>
          )}
          {invoice && (
            <>
              <div className="kv"><span>Invoice</span><span><StatusBadge label={invoice.status} /> {invoice.invoiceNumber}</span></div>
              <button onClick={() => router.push(`/invoices/${invoice.id}`)}>Open invoice</button>
            </>
          )}
          {job.paymentStatus === "unpaid" && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--color-divider)", paddingTop: 12 }}>
              <h3 style={{ marginTop: 0 }}>Record manual payment</h3>
              {status && <p style={{ fontSize: 12 }}>{status}</p>}
              <fieldset>
                <label>
                  Method
                  <br />
                  <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    <option value="cash">Cash</option>
                    <option value="upi_manual">UPI (manual)</option>
                    <option value="bank_transfer">Bank transfer</option>
                  </select>
                </label>
              </fieldset>
              <fieldset>
                <label>
                  Reference (optional)
                  <br />
                  <input value={reference} onChange={(e) => setReference(e.target.value)} />
                </label>
              </fieldset>
              <button onClick={() => void handleRecordPayment()} disabled={recording}>
                {recording ? "Recording…" : `Record ${formatPaise(job.totalAmount)} received`}
              </button>
            </div>
          )}
        </div>
      </div>

      <h2>Lifecycle</h2>
      <table>
        <thead><tr><th>Status</th><th>Changed at</th><th>Changed by</th><th>Notes</th></tr></thead>
        <tbody>
          {job.statusHistory.map((h, i) => (
            <tr key={i}>
              <td><StatusBadge label={h.status} /></td>
              <td>{formatDateTime(h.changedAt)}</td>
              <td>{h.changedBy}</td>
              <td>{h.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {approvals.length > 0 && (
        <>
          <h2>Approvals</h2>
          <table>
            <thead><tr><th>Service</th><th>Status</th><th>Price impact</th><th>Requested</th></tr></thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td>{a.serviceName}</td>
                  <td><StatusBadge label={a.status} /></td>
                  <td>{formatPaise(a.priceImpact)}</td>
                  <td>{formatDateTime(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {warranty && (
        <>
          <h2>Warranty</h2>
          <div className="detail-card" style={{ maxWidth: 420 }}>
            <div className="kv"><span>{warranty.warrantyLabel}</span><span>{warranty.endDate ?? "No fixed term"}</span></div>
            <div className="kv"><span>Sealed</span><span>{formatDateTime(warranty.sealedAt)}</span></div>
            {warranty.revokedAt && <div className="kv"><span>Revoked</span><span>{warranty.revokedReason}</span></div>}
          </div>
        </>
      )}

      <h2>Audit history</h2>
      {audit.length === 0 ? (
        <p>No audit entries for this job.</p>
      ) : (
        <table>
          <thead><tr><th>Action</th><th>By</th><th>When</th></tr></thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id}>
                <td>{a.action}</td>
                <td>{a.performedByRole}</td>
                <td>{formatDateTime(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
