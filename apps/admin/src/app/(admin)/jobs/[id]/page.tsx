"use client";
import {OfflineReceiptPanel} from "../../../../components/OfflineReceiptPanel";
import {OFFLINE_RECEIPT_REGISTER_ENABLED} from "../../../../lib/backend-features";
import { MembershipSettlement } from "../../../../components/MembershipSettlement";
import { JobPaymentPanel } from "../../../../components/JobPaymentPanel";
import {jobActivityLabel} from "../../../../lib/job-activity-label";
import { membershipCoveredLabel } from "@autodeck/core";

import { goBackOrTo } from "../../../../lib/go-back";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import type { Booking, ServiceJob, Payment, Invoice, ApprovalRequest, Warranty, AuditLog, Customer, Vehicle, Service, PaymentMethod, Inspection, InspectionArea } from "@autodeck/core";
import { formatDuration } from "@autodeck/core";
import { functions } from "../../../../lib/firebase";
import { useAdminAuth } from "../../../../lib/auth-context";
import { listenToJob, getWarrantyForJob, listenToAuditForEntity, listenToInspectionForJob } from "../../../../lib/jobs-service";
import { listenToBooking, listenToApprovalsForJob, listenToPaymentForJob, listenToInvoiceForJob, getCustomer, getVehicle, getService } from "../../../../lib/bookings-service";
import { getStudioConfig } from "../../../../lib/studio-service";
import { StatusBadge } from "../../../../components/StatusBadge";
import { formatPaise, formatDateTime, formatDate } from "../../../../lib/format";
import { statusLabel } from "../../../../lib/status-label";
import { BookingPanels } from "../../../../components/BookingPanels";
import { JobControls } from "../../../../components/JobControls";
import { StageTrack } from "../../../../experience/StageTrack";

type RecordManualPaymentOutput = { paymentId: string; invoiceId: string };
type ConfirmManualPaymentOutput = { paymentId: string; invoiceId: string | null; alreadyCompleted: boolean };

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { claims,user } = useAdminAuth();

  const scopeGeneration=useRef(0);const[resolvedId,setResolvedId]=useState('');const[resolvedPrincipal,setResolvedPrincipal]=useState('');const[paymentScope,setPaymentScope]=useState('');
  const [attempt,setAttempt] = useState(0);
  const [bayName,setBayName] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [job, setJob] = useState<ServiceJob | null | undefined>(undefined);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [payment, setPayment] = useState<Payment | null | undefined>(undefined); // undefined = not loaded yet (never show "no payment" before the listener answers)
  const [linking, setLinking] = useState(false);
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
    const generation=++scopeGeneration.current;setError(null);setPayment(undefined);setInvoice(null);setCustomer(null);setVehicle(null);setService(null);setStatus(null);setResolvedId('');setResolvedPrincipal('');setPaymentScope('');setLinking(false);setRecording(false);setConfirming(false);setBooking(null);
    if (!id) {setJob(null);return undefined;}
    // Route change: clear the previous job FIRST - until this route's
    // listener delivers, nothing from the old job may stay on screen.
    setJob(undefined);
    const stop=listenToJob(id, value=>{if(scopeGeneration.current!==generation)return;setResolvedId(id);setResolvedPrincipal(user?.uid??'');setJob(value);setError(null);}, (err) =>{if(scopeGeneration.current===generation)setError(err.message)});return()=>{scopeGeneration.current++;stop()};
  }, [id,attempt,claims?.tenantId,user?.uid,claims?.role]);

  const bookingId = job?.bookingId ?? null;
  useEffect(() => {
    if (!bookingId) { setBooking(null); return undefined; }
    let alive=true;setBooking(null);const stop=listenToBooking(bookingId,v=>{if(alive)setBooking(v)},err=>{if(alive)setError(err.message)});return()=>{alive=false;stop()};
  }, [bookingId, attempt]);

  useEffect(() => {
    setPayment(undefined);setPaymentScope('');setInvoice(null);setApprovals([]);setInspection(null);setAudit([]);setWarranty(null);
    if(!job||!claims||!user||resolvedPrincipal!==user.uid||job.id!==id||job.tenantId!==claims.tenantId||resolvedId!==id)return;
    let alive=true;const scope=[id,claims.tenantId,user.uid].join('|');const safe=<T,>(set:(v:T)=>void)=>(v:T)=>{if(alive)set(v)};
    const fail=(err:Error)=>{if(alive){setPayment(undefined);setInvoice(null);setError(err.message)}};
    const unsubApprovals=listenToApprovalsForJob(job.id,claims.tenantId,safe(setApprovals),fail);
    const unsubPayment=listenToPaymentForJob(job.id,claims.tenantId,p=>{if(!alive)return;if(p&&(p.jobId!==id||p.tenantId!==claims.tenantId)){fail(Error('Payment record does not match this job.'));return}setPayment(p);setPaymentScope(scope)},fail);
    const unsubInvoice=listenToInvoiceForJob(job.id,claims.tenantId,v=>{if(!alive)return;if(v&&(v.jobId!==id||v.tenantId!==claims.tenantId)){fail(Error('Invoice does not match this job.'));return}setInvoice(v)},fail);
    const unsubAudit=listenToAuditForEntity(claims.tenantId,'ServiceJob',job.id,safe(setAudit),fail);
    const unsubInspection=listenToInspectionForJob(job.id,safe(setInspection),()=>{});
    void getWarrantyForJob(job.id).then(safe(setWarranty)).catch(()=>{if(alive)setWarranty(null)});
    void getCustomer(job.customerId).then(safe(setCustomer)).catch(()=>{if(alive)setCustomer(null)});
    void getVehicle(job.vehicleId).then(safe(setVehicle)).catch(()=>{if(alive)setVehicle(null)});
    void getService(job.serviceId).then(safe(setService)).catch(()=>{if(alive)setService(null)});
    return()=>{alive=false;unsubApprovals();unsubPayment();unsubInvoice();unsubAudit();unsubInspection()};
  },[job?.id,job?.customerId,job?.vehicleId,job?.serviceId,claims?.tenantId,attempt,resolvedId,id,user?.uid,resolvedPrincipal]);
  const currentScope=!!claims&&!!user&&resolvedPrincipal===user.uid&&resolvedId===id&&job?.id===id&&job?.tenantId===claims.tenantId;
  const currentPayment= currentScope&&paymentScope===[id,claims?.tenantId,user?.uid].join('|')?payment:undefined;

  async function handleRecordPayment() {
    if (!job||!currentScope||currentPayment===undefined) return;
    const generation=scopeGeneration.current;setStatus(null);
    setRecording(true);
    try {
      const fn = httpsCallable<{ jobId: string; method: PaymentMethod; manualReference?: string }, RecordManualPaymentOutput>(
        functions,
        "recordManualPayment",
      );
      await fn(reference ? { jobId: job.id, method, manualReference: reference } : { jobId: job.id, method });
      if(scopeGeneration.current===generation)setStatus("Payment recorded and invoice issued.");
      if(scopeGeneration.current===generation)setReference("");
    } catch (err) {
      if(scopeGeneration.current===generation)setStatus(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      if(scopeGeneration.current===generation)setRecording(false);
    }
  }

  async function handleCreateLink() {
    if (!job||!currentScope||currentPayment===undefined) return;
    const generation=scopeGeneration.current;setStatus(null);
    setLinking(true);
    try {
      const fn = httpsCallable<{ jobId: string; method: PaymentMethod }, { paymentId: string; paymentUrl: string | null; status: string }>(functions, "initiatePayment");
      const res = await fn({ jobId: job.id, method: "razorpay_payment_link" });
      if(scopeGeneration.current===generation)setStatus(res.data.paymentUrl ? "Payment link ready. Copy it or send it on WhatsApp." : "A payment is already in progress for this job.");
    } catch (err) {
      if(scopeGeneration.current===generation)setStatus(err instanceof Error ? err.message : "Could not create the payment link.");
    } finally {
      if(scopeGeneration.current===generation)setLinking(false);
    }
  }

  async function handleConfirmCashPayment() {
    if (!currentPayment||!currentScope) return;
    const generation=scopeGeneration.current;setStatus(null);
    setConfirming(true);
    try {
      const fn = httpsCallable<{ paymentId: string }, ConfirmManualPaymentOutput>(functions, "confirmManualPayment");
      await fn({ paymentId: currentPayment.id });
      if(scopeGeneration.current===generation)setStatus("Payment confirmed and invoice issued.");
    } catch (err) {
      if(scopeGeneration.current===generation)setStatus(err instanceof Error ? err.message : "Failed to confirm payment.");
    } finally {
      if(scopeGeneration.current===generation)setConfirming(false);
    }
  }

  useEffect(()=>{
    if(!job) return;
    let alive=true;setBayName("");
    void getStudioConfig(job.studioId).then(c=>{if(alive)setBayName(c?.bays.find(b=>b.id===job.bayId)?.name??"")}).catch(()=>{if(alive)setBayName("")});return()=>{alive=false};
  },[job?.studioId,job?.bayId,attempt]);

  if (error) return <div className="ax-panel"><p className="ax-status-msg ax-status-msg--warn" role="alert">{error}</p><button className="ax-button" onClick={()=>setAttempt(n=>n+1)}>Retry</button></div>;
  if (!currentScope && job!==null || job === undefined) return <p className="ax-label" role="status">Loading…</p>;
  if (job === null) {
    return (
      <div className="ax-empty">
        <p className="ax-title">Job not found</p>
        <p>It may have been removed, or the link is wrong.</p>
      </div>
    );
  }

  const plate = vehicle?.registrationNumber ?? "Vehicle";
  const car = vehicle ? `${vehicle.make} ${vehicle.model}` : "";

  return (
    <div className="ax-page ax-job-page">
      <button type="button" className="ax-back" onClick={() => goBackOrTo(router, "/jobs")}>‹ Back</button>

      <header className="ax-hero ax-job-hero">
        <div>
          <p className="ax-label">{job.isWalkIn ? "Walk-in job" : "Booked job"} · {service?.name ?? "Service"}</p>
          <h1>{plate}</h1>
          <p className="ax-hero-sub">{[car, customer?.name].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="ax-hero-side ax-job-summary">
          <span className="ax-label">Job stage</span><StatusBadge label={job.status} />
          <span className="ax-label">Job total</span><span className="ax-hero-total">{formatPaise(job.totalAmount)}</span>
          <span className="ax-label">Payment</span><StatusBadge label={membershipCoveredLabel(job) ?? ((payment as (Payment & {invoiceReviewNeeded?:boolean})|null)?.invoiceReviewNeeded ? "Received - needs review" : (payment?.status==="completed"&&job.paymentStatus!=="paid")||(job.paymentStatus==="paid"&&payment?.status!=="completed") ? "Payment records syncing" : job.paymentStatus)} />
          <details className="ax-job-price-details"><summary>Price breakdown</summary><div className="kv"><span>Service</span><span>{typeof job.priceBreakdown?.total==="number"?formatPaise(job.priceBreakdown.total):"Not available"}</span></div>{job.additionalWorkDelta!==0?<div className="kv"><span>Extra work</span><span>{formatPaise(job.additionalWorkDelta)}</span></div>:null}<p className="ax-note">Original booking prices and payment receipts are listed separately below.</p></details>
        </div>
      </header>

      <StageTrack current={job.status} compact />
      <JobControls job={job} routeId={id} />
      <MembershipSettlement job={job} booking={booking ?? null} />

      <div className="ax-detail">
        <div className="ax-detail-main">
          {booking ? <BookingPanels compact booking={booking} job={job} service={service} bayName={bayName} onError={setError} /> : null}
          <details className="ax-panel ax-job-disclosure">
            <summary>Stage history ({job.statusHistory.length})</summary>
            <ol className="ax-timeline">
              {[...job.statusHistory].reverse().map((h, i) => (
                <li key={i}>
                  <span className="ax-timeline-dot" aria-hidden="true" />
                  <span>
                    {statusLabel(h.status)}
                    {h.notes && <span className="ax-timeline-note">{h.notes}</span>}
                  </span>
                  <span className="ax-timeline-meta">{formatDateTime(h.changedAt)}</span>
                </li>
              ))}
            </ol>
          </details>

          {inspection && (
            <section className="ax-panel">
              <span className="ax-label">Inspection · {inspection.status === "finalized" ? "Finalized" : "In progress"}</span>
              {inspection.finalizedAt && <p className="ax-note" style={{ marginTop: 0 }}>Finalized {formatDateTime(inspection.finalizedAt)}</p>}
              {(["exterior", "glass", "interior", "service_specific"] as InspectionArea[]).map((area) => {
                const items = inspection.checklist.filter((i) => i.area === area && i.rating);
                if (items.length === 0) return null;
                return (
                  <div key={area} style={{ marginTop: 12 }}>
                    <p className="ax-label" style={{ margin: "0 0 4px" }}>{area.replace("_", " ")}</p>
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
            <section className="ax-panel">
              <span className="ax-label">Extra work approvals</span>
              <table>
                <thead><tr><th>Work</th><th>Status</th><th style={{ textAlign: "right" }}>Price</th><th>Asked</th></tr></thead>
                <tbody>
                  {approvals.map((a) => (
                    <tr key={a.id}>
                      <td>{a.serviceName}</td>
                      <td><StatusBadge label={a.status} /></td>
                      <td className="ax-data" style={{ textAlign: "right" }}>{formatPaise(a.priceImpact)}</td>
                      <td>{formatDateTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <details className="ax-panel ax-job-disclosure">
            <summary>Job activity ({audit.length})</summary>
            {audit.length === 0 ? (
              <p className="ax-note" style={{ marginTop: 0 }}>No recorded changes yet.</p>
            ) : (
              <ol className="ax-timeline">
                {audit.map((a) => (
                  <li key={a.id}>
                    <span className="ax-timeline-dot" style={{ background: "var(--ad-inactive)" }} aria-hidden="true" />
                    <span>{jobActivityLabel(a.action)}<span className="ax-timeline-note">by {statusLabel(a.performedByRole)}</span></span>
                    <span className="ax-timeline-meta">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </details>
        </div>

        <aside className="ax-detail-side">
          <details className="ax-panel ax-job-disclosure">
            <summary>Car and owner</summary>
            <div className="kv"><span>Customer</span><span>{customer?.name ?? "-"}</span></div>
            {customer?.phone && <div className="kv"><span>Phone</span><span><a href={`tel:${customer.phone}`}>{customer.phone}</a></span></div>}
            <div className="kv"><span>Vehicle</span><span>{car || "-"}</span></div>
            <div className="kv"><span>Plate</span><span className="ax-data">{vehicle?.registrationNumber ?? "-"}</span></div>
            <div className="ax-panel-actions">
              {customer?.id && <button type="button" className="ax-button" onClick={() => router.push(`/customers/${customer.id}`)}>Open customer</button>}
            </div>
          </details>

          <details className="ax-panel ax-job-disclosure">
            <summary>Bay and timing</summary>
            <div className="kv"><span>Bay</span><span>{job.status === "STANDBY" ? "No bay reserved" : bayName || "Assigned bay"}</span></div>
            <div className="kv"><span>Starts</span><span>{job.status === "STANDBY" ? "Waiting - no slot reserved" : formatDateTime(job.scheduledAt)}</span></div>
            <div className="kv"><span>Est. finish</span><span>{formatDateTime(job.estimatedEndAt)}</span></div>
            <div className="kv">
              <span>Work time</span>
              <span>
                {job.estimatedDurationMinutes < 24 * 60
                  ? `About ${formatDuration(job.estimatedDurationMinutes)}`
                  : `About ${Math.round(job.estimatedDurationMinutes / 60)} hrs`}
              </span>
            </div>
            {job.scheduledDate !== job.estimatedEndDate && (
              <p className="ax-note">Multi-day job. The bay is held {formatDate(job.scheduledDate)} to {formatDate(job.estimatedEndDate)}.</p>
            )}
            {job.sealedAt && <div className="kv"><span>Sealed</span><span>{formatDateTime(job.sealedAt)}</span></div>}
          </details>


          {OFFLINE_RECEIPT_REGISTER_ENABLED && currentScope && currentPayment !== undefined ? <OfflineReceiptPanel key={[job.id,user?.uid,claims?.tenantId].join("|")} jobId={job.id}/> : null}
          <JobPaymentPanel compact onRefreshPayment={()=>{setPayment(undefined);setStatus("Refreshing AutoDeck payment record. This does not charge or record money.");setAttempt(n=>n+1)}}
            job={job}
            booking={booking}
            payment={currentPayment}
            invoice={invoice}
            customer={customer}
            status={status}
            setStatus={setStatus}
            method={method}
            setMethod={setMethod}
            reference={reference}
            setReference={setReference}
            linking={linking}
            recording={recording}
            confirming={confirming}
            onCreateLink={() => void handleCreateLink()}
            onRecordPayment={() => void handleRecordPayment()}
            onConfirmCashPayment={() => void handleConfirmCashPayment()}
            onOpenInvoice={(invoiceId) => router.push(`/invoices/${invoiceId}`)}
          />

          {warranty && (
            <section className="ax-panel">
              <span className="ax-label">Protection</span>
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
