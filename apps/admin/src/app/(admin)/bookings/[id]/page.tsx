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
import { formatPaise, formatDateTime } from "../../../../lib/format";

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
  if (booking === undefined) return <p>Loading…</p>;
  if (booking === null) return <p>Booking not found.</p>;

  return (
    <div>
      <button onClick={() => router.push("/bookings")}>&larr; Bookings</button>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        Booking {booking.id}
        <StatusBadge label={booking.status} />
      </h1>

      <div className="detail-grid">
        <div className="detail-card">
          <h3>Customer &amp; Vehicle</h3>
          <div className="kv"><span>Customer</span><span>{customer?.name ?? booking.customerId}</span></div>
          <div className="kv"><span>Phone</span><span>{customer?.phone ?? "—"}</span></div>
          <div className="kv"><span>Vehicle</span><span>{vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}` : booking.vehicleId}</span></div>
          <div className="kv"><span>Category</span><span>{booking.vehicleCategory}</span></div>
        </div>

        <div className="detail-card">
          <h3>Service &amp; Slot</h3>
          <div className="kv"><span>Service</span><span>{service?.name ?? booking.serviceId}</span></div>
          <div className="kv"><span>Scheduled</span><span>{formatDateTime(booking.scheduledAt)}</span></div>
          <div className="kv"><span>Duration</span><span>{booking.durationMinutes} min</span></div>
          <div className="kv"><span>Bay</span><span>{booking.bayId}</span></div>
          <div className="kv"><span>Rescheduled</span><span>{booking.rescheduleCount}×</span></div>
        </div>

        <div className="detail-card">
          <h3>Payment &amp; Membership</h3>
          <div className="kv"><span>Payment status</span><span><StatusBadge label={booking.paymentStatus} /></span></div>
          <div className="kv"><span>Total</span><span>{formatPaise(booking.totalAmount)}</span></div>
          <div className="kv"><span>Membership applied</span><span>{booking.membershipDiscountApplied ? (booking.membershipWashUsed ? "Wash credit" : "Discount") : "No"}</span></div>
          {payment && (
            <div className="kv"><span>Payment record</span><span><StatusBadge label={payment.status} /> · {payment.method}</span></div>
          )}
        </div>

        <div className="detail-card">
          <h3>Job &amp; Invoice</h3>
          {job ? (
            <>
              <div className="kv"><span>Job status</span><span><StatusBadge label={job.status} /></span></div>
              <div className="kv"><span>Additional work</span><span>{formatPaise(job.additionalWorkDelta)}</span></div>
              <button onClick={() => router.push(`/jobs/${job.id}`)}>Open job</button>
            </>
          ) : (
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13 }}>No job created yet.</p>
          )}
          {invoice && (
            <div style={{ marginTop: 8 }}>
              <div className="kv"><span>Invoice</span><span><StatusBadge label={invoice.status} /> {invoice.invoiceNumber}</span></div>
              <button onClick={() => router.push(`/invoices/${invoice.id}`)}>Open invoice</button>
            </div>
          )}
        </div>
      </div>

      <h2>Price breakdown</h2>
      <div className="detail-card" style={{ maxWidth: 420 }}>
        <div className="kv"><span>Base price</span><span>{formatPaise(booking.priceBreakdown.basePrice)}</span></div>
        <div className="kv"><span>Scope adjustment</span><span>{formatPaise(booking.priceBreakdown.scopeAdjustment)}</span></div>
        {booking.priceBreakdown.membershipDiscount !== null && (
          <div className="kv"><span>Membership discount</span><span>-{formatPaise(booking.priceBreakdown.membershipDiscount)}</span></div>
        )}
        <div className="kv"><span>Subtotal</span><span>{formatPaise(booking.priceBreakdown.subtotal)}</span></div>
        <div className="kv"><span>{booking.priceBreakdown.taxDescription}</span><span>{formatPaise(booking.priceBreakdown.tax)}</span></div>
        <div className="kv"><span><strong>Total</strong></span><span><strong>{formatPaise(booking.priceBreakdown.total)}</strong></span></div>
      </div>

      {approvals.length > 0 && (
        <>
          <h2>Approvals</h2>
          <table>
            <thead>
              <tr><th>Service</th><th>Status</th><th>Price impact</th><th>Requested</th></tr>
            </thead>
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
    </div>
  );
}
