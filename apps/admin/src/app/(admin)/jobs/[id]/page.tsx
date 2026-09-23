"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import type { ServiceJob, Payment, Invoice, ApprovalRequest, Warranty, AuditLog, Customer, Vehicle, Service, PaymentMethod, Inspection, InspectionArea } from "@autodeck/core";
import { functions } from "../../../../lib/firebase";
import { useAdminAuth } from "../../../../lib/auth-context";
import { listenToJob, getWarrantyForJob, listenToAuditForEntity, listenToInspectionForJob } from "../../../../lib/jobs-service";
import { listenToApprovalsForJob, listenToPaymentForJob, listenToInvoiceForJob, getCustomer, getVehicle, getService } from "../../../../lib/bookings-service";
import { StatusBadge } from "../../../../components/StatusBadge";
import { formatPaise, formatDateTime, formatDate } from "../../../../lib/format";
import { statusLabel } from "../../../../lib/status-label";
import { StageTrack } from "../../../../experience/StageTrack";

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
  const [inspection, setInspection] = useState<Inspection | null>(null);
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
    const unsubInspection = listenToInspectionForJob(job.id, setInspection, () => undefined);
    void getWarrantyForJob(job.id).then(setWarranty);
    return () => {
      unsubApprovals();
      unsubPayment();
      unsubInvoice();
      unsubAudit();
      unsubInspection();
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
  if (job === undefined) return <p className="ad-label" role="status">Loading…</p>;
  if (job === null) {
    return (
      <div className="ad-empty">
        <p className="ad-title">Job not found</p>
        <p>It may have been removed, or the link is wrong.</p>
      </div>
    );
  }

  const plate = vehicle?.registrationNumber ?? "Vehicle";
  const car = vehicle ? `${vehicle.make} ${vehicle.model}` : "";
  const METHOD_LABEL: Record<string, string> = { cash: "Cash", upi_manual: "UPI", bank_transfer: "Bank transfer", razorpay_payment_link: "Online (Razorpay)" };

  return (
    <div className="ad-page">
      <button type="button" className="ad-back" onClick={() => router.push("/jobs")}>‹ Studio floor</button>

      <header className="ad-hero">
        <div>
          <p className="ad-label">{job.isWalkIn ? "Walk-in job" : "Booked job"} · {service?.name ?? "Service"}</p>
          <h1>{plate}</h1>
          <p className="ad-hero-sub">{[car, customer?.name].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="ad-hero-side">
          <StatusBadge label={job.status} />
          <span className="ad-hero-total">{formatPaise(job.totalAmount)}</span>
          <StatusBadge label={job.paymentStatus} />
        </div>
      </header>

      <StageTrack current={job.status} />

      <div className="ad-detail">
        <div className="ad-detail-main">
          <section className="ad-panel">
            <span className="ad-label">Timeline</span>
            <ol className="ad-timeline">
              {[...job.statusHistory].reverse().map((h, i) => (
                <li key={i}>
                  <span className="ad-timeline-dot" aria-hidden="true" />
                  <span>
                    {statusLabel(h.status)}
                    {h.notes && <span className="ad-timeline-note">{h.notes}</span>}
                  </span>
                  <span className="ad-timeline-meta">{formatDateTime(h.changedAt)}</span>
                </li>
              ))}
            </ol>
          </section>

          {inspection && (
            <section className="ad-panel">
              <span className="ad-label">Inspection · {inspection.status === "finalized" ? "Finalized" : "In progress"}</span>
              {inspection.finalizedAt && <p className="ad-note" style={{ marginTop: 0 }}>Finalized {formatDateTime(inspection.finalizedAt)}</p>}
              {(["exterior", "glass", "interior", "service_specific"] as InspectionArea[]).map((area) => {
                const items = inspection.checklist.filter((i) => i.area === area && i.rating);
                if (items.length === 0) return null;
                return (
                  <div key={area} style={{ marginTop: 12 }}>
                    <p className="ad-label" style={{ margin: "0 0 4px" }}>{area.replace("_", " ")}</p>
                    {items.map((item) => (
                      <div className="kv" key={item.key}>
                        <span>{item.label}</span>
                        <span>{statusLabel(item.rating ?? "")}{item.notes ? ` · ${item.notes}` : ""}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {inspection.overallNotes && <p style={{ marginTop: 12, marginBottom: 0 }}>{inspection.overallNotes}</p>}
            </section>
          )}

          {approvals.length > 0 && (
            <section className="ad-panel">
              <span className="ad-label">Extra work approvals</span>
              <table>
                <thead><tr><th>Work</th><th>Status</th><th style={{ textAlign: "right" }}>Price</th><th>Asked</th></tr></thead>
                <tbody>
                  {approvals.map((a) => (
                    <tr key={a.id}>
                      <td>{a.serviceName}</td>
                      <td><StatusBadge label={a.status} /></td>
                      <td className="ad-data" style={{ textAlign: "right" }}>{formatPaise(a.priceImpact)}</td>
                      <td>{formatDateTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="ad-panel">
            <span className="ad-label">Activity</span>
            {audit.length === 0 ? (
              <p className="ad-note" style={{ marginTop: 0 }}>No recorded changes yet.</p>
            ) : (
              <ol className="ad-timeline">
                {audit.map((a) => (
                  <li key={a.id}>
                    <span className="ad-timeline-dot" style={{ background: "var(--ad-inactive)" }} aria-hidden="true" />
                    <span>{statusLabel(a.action)}<span className="ad-timeline-note">by {statusLabel(a.performedByRole)}</span></span>
                    <span className="ad-timeline-meta">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="ad-detail-side">
          <section className="ad-panel">
            <span className="ad-label">Car and owner</span>
            <div className="kv"><span>Customer</span><span>{customer?.name ?? "—"}</span></div>
            {customer?.phone && <div className="kv"><span>Phone</span><span><a href={`tel:${customer.phone}`}>{customer.phone}</a></span></div>}
            <div className="kv"><span>Vehicle</span><span>{car || "—"}</span></div>
            <div className="kv"><span>Plate</span><span className="ad-data">{vehicle?.registrationNumber ?? "—"}</span></div>
            <div className="ad-panel-actions">
              {job.bookingId && <button type="button" className="ad-button" onClick={() => router.push(`/bookings/${job.bookingId}`)}>Open booking</button>}
            </div>
          </section>

          <section className="ad-panel">
            <span className="ad-label">Bay and timing</span>
            <div className="kv"><span>Bay</span><span>{job.bayId}</span></div>
            <div className="kv"><span>Starts</span><span>{formatDateTime(job.scheduledAt)}</span></div>
            <div className="kv"><span>Est. finish</span><span>{formatDateTime(job.estimatedEndAt)}</span></div>
            <div className="kv">
              <span>Work time</span>
              <span>
                {job.estimatedDurationMinutes < 24 * 60
                  ? `About ${job.estimatedDurationMinutes} min`
                  : `About ${Math.round(job.estimatedDurationMinutes / 60)} hrs`}
              </span>
            </div>
            {job.scheduledDate !== job.estimatedEndDate && (
              <p className="ad-note">Multi-day job. The bay is held {formatDate(job.scheduledDate)} to {formatDate(job.estimatedEndDate)}.</p>
            )}
            {job.sealedAt && <div className="kv"><span>Sealed</span><span>{formatDateTime(job.sealedAt)}</span></div>}
          </section>

          <section className="ad-panel">
            <span className="ad-label">Price</span>
            <div className="kv"><span>Service</span><span className="ad-data">{formatPaise(job.priceBreakdown.total)}</span></div>
            <div className="kv"><span>Extra work</span><span className="ad-data">{formatPaise(job.additionalWorkDelta)}</span></div>
            <div className="kv"><span>Total</span><span className="ad-data" style={{ color: "var(--ad-text-primary)" }}>{formatPaise(job.totalAmount)}</span></div>
          </section>

          <section className="ad-panel">
            <span className="ad-label">Payment</span>
            {status && <p className="ad-status-msg" role="status">{status}</p>}
            {payment ? (
              <>
                <div className="kv"><span>{METHOD_LABEL[payment.method] ?? statusLabel(payment.method)}</span><span><StatusBadge label={payment.status} /></span></div>
                <div className="kv"><span>Amount</span><span className="ad-data">{formatPaise(payment.amount)}</span></div>
                {(payment.status === "pending" || payment.status === "processing") &&
                  (payment.method === "razorpay_payment_link" ? (
                    <p className="ad-note">Waiting for the payment provider to confirm the online payment.</p>
                  ) : (
                    <div className="ad-panel-actions">
                      <button type="button" className="ad-button ad-button--primary" onClick={() => void handleConfirmCashPayment()} disabled={confirming}>
                        {confirming ? "Confirming…" : "Confirm money received"}
                      </button>
                    </div>
                  ))}
              </>
            ) : (
              <p className="ad-note" style={{ marginTop: 0 }}>No payment started yet.</p>
            )}
            {invoice && (
              <>
                <div className="kv"><span>Invoice {invoice.invoiceNumber}</span><span><StatusBadge label={invoice.status} /></span></div>
                <div className="ad-panel-actions">
                  <button type="button" className="ad-button" onClick={() => router.push(`/invoices/${invoice.id}`)}>Open invoice</button>
                </div>
              </>
            )}
            {job.paymentStatus === "unpaid" && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--ad-border-subtle)" }}>
                <p className="ad-label" style={{ margin: "0 0 12px" }}>Record a payment taken at the counter</p>
                <label className="ad-form-row">
                  <span className="ad-label">Method</span>
                  <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    <option value="cash">Cash</option>
                    <option value="upi_manual">UPI</option>
                    <option value="bank_transfer">Bank transfer</option>
                  </select>
                </label>
                <label className="ad-form-row">
                  <span className="ad-label">Reference (optional)</span>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI or transfer reference" />
                </label>
                <button type="button" className="ad-button ad-button--primary" style={{ width: "100%" }} onClick={() => void handleRecordPayment()} disabled={recording}>
                  {recording ? "Recording…" : `Record ${formatPaise(job.totalAmount)} received`}
                </button>
              </div>
            )}
          </section>

          {warranty && (
            <section className="ad-panel">
              <span className="ad-label">Protection</span>
              <div className="kv"><span>{warranty.warrantyLabel}</span><span>{warranty.endDate ? `Until ${formatDate(warranty.endDate)}` : "No fixed term"}</span></div>
              <div className="kv"><span>Sealed</span><span>{formatDateTime(warranty.sealedAt)}</span></div>
              {warranty.revokedAt && <div className="kv"><span>Revoked</span><span>{warranty.revokedReason}</span></div>}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
