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
  if (booking === undefined) return <p className="ad-label" role="status">Loading…</p>;
  if (booking === null) {
    return (
      <div className="ad-empty">
        <p className="ad-title">Booking not found</p>
        <p>It may have been removed, or the link is wrong.</p>
      </div>
    );
  }

  const car = vehicle ? `${vehicle.make} ${vehicle.model}` : "";
  const pb = booking.priceBreakdown;

  return (
    <div className="ad-page">
      <button type="button" className="ad-back" onClick={() => router.push("/bookings")}>‹ Bookings</button>

      <header className="ad-hero">
        <div>
          <p className="ad-label">Booking · {formatDayLong(booking.scheduledDate)} at {formatTime(booking.scheduledAt)}</p>
          <h1>{vehicle?.registrationNumber ?? "Vehicle"}</h1>
          <p className="ad-hero-sub">{[service?.name, car, customer?.name].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="ad-hero-side">
          <StatusBadge label={booking.status} />
          <span className="ad-hero-total">{formatPaise(booking.totalAmount)}</span>
          <StatusBadge label={booking.paymentStatus} />
        </div>
      </header>

      <div className="ad-detail">
        <div className="ad-detail-main">
          <section className="ad-panel">
            <span className="ad-label">Slot</span>
            <div className="kv"><span>Date</span><span>{formatDayLong(booking.scheduledDate)}</span></div>
            <div className="kv"><span>Time</span><span>{formatTime(booking.scheduledAt)} to {formatTime(booking.estimatedEndAt)}</span></div>
            <div className="kv"><span>Length</span><span>{booking.durationMinutes} min</span></div>
            <div className="kv"><span>Bay</span><span>{booking.bayId}</span></div>
            {booking.rescheduleCount > 0 && <div className="kv"><span>Rescheduled</span><span>{booking.rescheduleCount} {booking.rescheduleCount === 1 ? "time" : "times"}</span></div>}
          </section>

          <section className="ad-panel">
            <span className="ad-label">Price</span>
            <div className="kv"><span>{service?.name ?? "Service"}</span><span className="ad-data">{formatPaise(pb.basePrice)}</span></div>
            {pb.scopeAdjustment !== 0 && <div className="kv"><span>Size and scope</span><span className="ad-data">{formatPaise(pb.scopeAdjustment)}</span></div>}
            {pb.membershipDiscount !== null && (
              <div className="kv"><span>Membership</span><span className="ad-data" style={{ color: "var(--ad-premium)" }}>-{formatPaise(pb.membershipDiscount)}</span></div>
            )}
            <div className="kv"><span>Subtotal</span><span className="ad-data">{formatPaise(pb.subtotal)}</span></div>
            <div className="kv"><span>{pb.taxDescription}</span><span className="ad-data">{formatPaise(pb.tax)}</span></div>
            <div className="kv"><span>Total</span><span className="ad-data" style={{ color: "var(--ad-text-primary)" }}>{formatPaise(pb.total)}</span></div>
            {booking.membershipDiscountApplied && (
              <p className="ad-note">{booking.membershipWashUsed ? "Paid with a membership wash credit." : "Membership discount applied."}</p>
            )}
          </section>

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
        </div>

        <aside className="ad-detail-side">
          <section className="ad-panel">
            <span className="ad-label">Car and owner</span>
            <div className="kv"><span>Customer</span><span>{customer?.name ?? "—"}</span></div>
            <div className="kv"><span>Phone</span><span>{customer?.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : "—"}</span></div>
            <div className="kv"><span>Vehicle</span><span>{car || "—"}</span></div>
            <div className="kv"><span>Plate</span><span className="ad-data">{vehicle?.registrationNumber ?? "—"}</span></div>
            <div className="kv"><span>Category</span><span>{statusLabel(booking.vehicleCategory)}</span></div>
          </section>

          <section className="ad-panel">
            <span className="ad-label">In the studio</span>
            {job ? (
              <>
                <div className="kv"><span>Job</span><span><StatusBadge label={job.status} /></span></div>
                {job.additionalWorkDelta !== 0 && <div className="kv"><span>Extra work</span><span className="ad-data">{formatPaise(job.additionalWorkDelta)}</span></div>}
                <div className="ad-panel-actions">
                  <button type="button" className="ad-button ad-button--primary" onClick={() => router.push(`/jobs/${job.id}`)}>Open job</button>
                </div>
              </>
            ) : (
              <p className="ad-note" style={{ marginTop: 0 }}>The job opens when the car is checked in.</p>
            )}
          </section>

          <section className="ad-panel">
            <span className="ad-label">Payment</span>
            {payment ? (
              <div className="kv"><span>{statusLabel(payment.method)}</span><span><StatusBadge label={payment.status} /></span></div>
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
          </section>
        </aside>
      </div>
    </div>
  );
}
