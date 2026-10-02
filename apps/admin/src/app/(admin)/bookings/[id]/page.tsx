"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Booking, ServiceJob, Payment, Invoice, ApprovalRequest, Customer, Vehicle, Service } from "@autodeck/core";
import { useAdminAuth } from "../../../../lib/auth-context";
import {
  listenToBooking,
  listenToJobForBooking,
  listenToApprovalsForJob,
  listenToPaymentForJob,
  listenToInvoiceForJob,
  getCustomer,
  getVehicle,
  getService,
} from "../../../../lib/bookings-service";
import { setBookingQuote } from "../../../../lib/bookings-service";
import { StatusBadge } from "../../../../components/StatusBadge";
import { formatPaise, formatDateTime, formatDayLong, formatTime } from "../../../../lib/format";
import { statusLabel } from "../../../../lib/status-label";

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { claims } = useAdminAuth();

  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteRupees, setQuoteRupees] = useState("");
  const [quoteBusy, setQuoteBusy] = useState(false);
  async function submitQuote() {
    if (!booking) return;
    const n = Math.round(Number(quoteRupees) * 100);
    if (!Number.isFinite(n) || n < 100) { setError("Enter the quote in rupees, at least 1."); return; }
    setQuoteBusy(true);
    try {
      await setBookingQuote(booking.id, n);
      setError(null);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the quote.");
    } finally { setQuoteBusy(false); }
  }

  useEffect(() => {
    if (!id) return undefined;
    return listenToBooking(id, setBooking, (err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!booking || !claims) return undefined;
    return listenToJobForBooking(booking.id, claims.tenantId, setJob, (err) => setError(err.message));
  }, [booking?.id, claims]);

  useEffect(() => {
    if (!job || !claims) return undefined;
    const unsubApprovals = listenToApprovalsForJob(job.id, claims.tenantId, setApprovals, (err) => setError(err.message));
    const unsubPayment = listenToPaymentForJob(job.id, claims.tenantId, setPayment, (err) => setError(err.message));
    const unsubInvoice = listenToInvoiceForJob(job.id, claims.tenantId, setInvoice, (err) => setError(err.message));
    return () => {
      unsubApprovals();
      unsubPayment();
      unsubInvoice();
    };
  }, [job?.id, claims]);

  useEffect(() => {
    if (!booking) return;
    void getCustomer(booking.customerId).then(setCustomer);
    void getVehicle(booking.vehicleId).then(setVehicle);
    void getService(booking.serviceId).then(setService);
  }, [booking]);

  if (error) return <p className="error">{error}</p>;
  if (booking === undefined) return <p className="ax-label" role="status">Loading…</p>;
  if (booking === null) {
    return (
      <div className="ax-empty">
        <p className="ax-title">Booking not found</p>
        <p>It may have been removed, or the link is wrong.</p>
      </div>
    );
  }

  const car = vehicle ? `${vehicle.make} ${vehicle.model}` : "";
  const pb = booking.priceBreakdown;

  return (
    <div className="ax-page">
      <button type="button" className="ax-back" onClick={() => router.push("/bookings")}>‹ Bookings</button>

      <header className="ax-hero">
        <div>
          <p className="ax-label">Booking · {formatDayLong(booking.scheduledDate)} at {formatTime(booking.scheduledAt)}</p>
          <h1>{vehicle?.registrationNumber ?? "Vehicle"}</h1>
          <p className="ax-hero-sub">{[service?.name, car, customer?.name].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="ax-hero-side">
          <StatusBadge label={booking.status} />
          <span className="ax-hero-total">{formatPaise(booking.totalAmount)}</span>
          <StatusBadge label={booking.paymentStatus} />
        </div>
      </header>

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            <span className="ax-label">Slot</span>
            <div className="kv"><span>Date</span><span>{formatDayLong(booking.scheduledDate)}</span></div>
            <div className="kv"><span>Time</span><span>{formatTime(booking.scheduledAt)} to {formatTime(booking.estimatedEndAt)}</span></div>
            <div className="kv"><span>Length</span><span>{booking.durationMinutes} min</span></div>
            <div className="kv"><span>Bay</span><span>{booking.bayId}</span></div>
            {booking.rescheduleCount > 0 && <div className="kv"><span>Rescheduled</span><span>{booking.rescheduleCount} {booking.rescheduleCount === 1 ? "time" : "times"}</span></div>}
          </section>

          {booking.priceOnRequest === true && (
            <section className="ax-panel">
              <span className="ax-label">Quote</span>
              <div className="kv"><span>{service?.brand ? `${service.brand} · ` : ""}{service?.name ?? "Product"}</span><span>{booking.quoteStatus === "approved" ? "Customer approved" : booking.quoteStatus === "quoted" ? "Waiting for customer" : "Needs a price"}</span></div>
              {booking.quoteStatus !== "approved" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                  <input className="ax-input" inputMode="decimal" placeholder="Price in rupees, before tax" value={quoteRupees} onChange={(e) => setQuoteRupees(e.target.value)} />
                  <button type="button" className="ax-button ax-button--primary" disabled={quoteBusy} onClick={() => void submitQuote()}>{booking.quoteStatus === "quoted" ? "Update quote" : "Send quote"}</button>
                </div>
              )}
              <p className="ax-note">Work cannot start until the customer approves the quote.</p>
            </section>
          )}

          <section className="ax-panel">
            <span className="ax-label">Price</span>
            <div className="kv"><span>{service?.name ?? "Service"}</span><span className="ax-data">{formatPaise(pb.basePrice)}</span></div>
            {pb.scopeAdjustment !== 0 && <div className="kv"><span>Size and scope</span><span className="ax-data">{formatPaise(pb.scopeAdjustment)}</span></div>}
            {pb.membershipDiscount !== null && (
              <div className="kv"><span>Membership</span><span className="ax-data" style={{ color: "var(--ad-premium)" }}>-{formatPaise(pb.membershipDiscount)}</span></div>
            )}
            <div className="kv"><span>Subtotal</span><span className="ax-data">{formatPaise(pb.subtotal)}</span></div>
            <div className="kv"><span>{pb.taxDescription}</span><span className="ax-data">{formatPaise(pb.tax)}</span></div>
            <div className="kv"><span>Total</span><span className="ax-data" style={{ color: "var(--ad-text-primary)" }}>{formatPaise(pb.total)}</span></div>
            {booking.membershipDiscountApplied && (
              <p className="ax-note">{booking.membershipWashUsed ? "Paid with a membership wash credit." : "Membership discount applied."}</p>
            )}
          </section>

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
        </div>

        <aside className="ax-detail-side">
          <section className="ax-panel">
            <span className="ax-label">Car and owner</span>
            <div className="kv"><span>Customer</span><span>{customer?.name ?? "-"}</span></div>
            <div className="kv"><span>Phone</span><span>{customer?.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : "-"}</span></div>
            <div className="kv"><span>Vehicle</span><span>{car || "-"}</span></div>
            <div className="kv"><span>Plate</span><span className="ax-data">{vehicle?.registrationNumber ?? "-"}</span></div>
            <div className="kv"><span>Category</span><span>{statusLabel(booking.vehicleCategory)}</span></div>
          </section>

          <section className="ax-panel">
            <span className="ax-label">In the studio</span>
            {job ? (
              <>
                <div className="kv"><span>Job</span><span><StatusBadge label={job.status} /></span></div>
                {job.additionalWorkDelta !== 0 && <div className="kv"><span>Extra work</span><span className="ax-data">{formatPaise(job.additionalWorkDelta)}</span></div>}
                <div className="ax-panel-actions">
                  <button type="button" className="ax-button ax-button--primary" onClick={() => router.push(`/jobs/${job.id}`)}>Open job</button>
                </div>
              </>
            ) : (
              <p className="ax-note" style={{ marginTop: 0 }}>The job opens when the car is checked in.</p>
            )}
          </section>

          <section className="ax-panel">
            <span className="ax-label">Payment</span>
            {payment ? (
              <div className="kv"><span>{statusLabel(payment.method)}</span><span><StatusBadge label={payment.status} /></span></div>
            ) : (
              <p className="ax-note" style={{ marginTop: 0 }}>No payment started yet.</p>
            )}
            {invoice && (
              <>
                <div className="kv"><span>Invoice {invoice.invoiceNumber}</span><span><StatusBadge label={invoice.status} /></span></div>
                <div className="ax-panel-actions">
                  <button type="button" className="ax-button" onClick={() => router.push(`/invoices/${invoice.id}`)}>Open invoice</button>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
