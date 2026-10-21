"use client";

import { goBackOrTo } from "../../../../lib/go-back";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { bookingCode, isBookingMissed, type Booking, type ServiceJob, type Payment, type Invoice, type ApprovalRequest, type Customer, type Vehicle, type Service } from "@autodeck/core";
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
import { getStudioConfig } from "../../../../lib/studio-service";
import { StatusBadge } from "../../../../components/StatusBadge";
import { BookingPanels } from "../../../../components/BookingPanels";
import { formatPaise, formatDateTime, formatDayLong, formatTime } from "../../../../lib/format";
import { statusLabel } from "../../../../lib/status-label";

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { claims } = useAdminAuth();

  const [attempt,setAttempt] = useState(0);
  const [bayName,setBayName] = useState("");
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
    setError(null);
    if (!id) {setBooking(null);return undefined;}
    return listenToBooking(id, value=>{setBooking(value);setError(null);}, (err) => setError(err.message));
  }, [id,attempt]);

  useEffect(() => {
    if (!booking || !claims) return undefined;
    return listenToJobForBooking(booking.id, claims.tenantId, setJob, (err) => setError(err.message));
  }, [booking?.id, claims,attempt]);

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
  }, [job?.id, claims,attempt]);

  useEffect(() => {
    if (!booking) return;
    void getCustomer(booking.customerId).then(setCustomer).catch(()=>setCustomer(null));
    void getVehicle(booking.vehicleId).then(setVehicle).catch(()=>setVehicle(null));
    void getService(booking.serviceId).then(setService).catch(()=>setService(null));
  }, [booking]);

  useEffect(()=>{
    if(!booking) return;
    setBayName("");
    void getStudioConfig(booking.studioId).then(c=>setBayName(c?.bays.find(b=>b.id===booking.bayId)?.name??"")).catch(()=>setBayName(""));
  },[booking?.studioId,booking?.bayId,attempt]);

  // One detail page per visit: once the car is checked in, the Job page shows the booking too.
  useEffect(() => {
    if (job) router.replace(`/jobs/${job.id}`);
  }, [job, router]);

  if (error) return <div className="ax-panel"><p className="ax-status-msg ax-status-msg--warn" role="alert">{error}</p><button className="ax-button" onClick={()=>setAttempt(n=>n+1)}>Retry</button></div>;
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
      <button type="button" className="ax-back" onClick={() => goBackOrTo(router, "/bookings")}>‹ Bookings</button>

      <header className="ax-hero">
        <div>
          <p className="ax-label">Booking · {formatDayLong(booking.scheduledDate)} at {formatTime(booking.scheduledAt)}</p>
          <h1>{vehicle?.registrationNumber ?? "Vehicle"}</h1>
          <p className="ax-hero-sub">{[service?.name, car, customer?.name].filter(Boolean).join(" · ")}</p>
          {booking.status === "CANCELLED" ? <p className="ax-hero-sub">{booking.cancellationFeePaise ? `Cancelled${booking.cancelledBy === "admin" ? " by the studio" : booking.cancelledBy === "system" ? " (visitor did not arrive)" : " by the customer"}. Cancellation fee ${formatPaise(booking.cancellationFeePaise)}${booking.cancellationFeeStatus === "due" || !booking.cancellationFeeStatus ? ", collect or waive at the studio." : booking.cancellationFeeStatus === "withheld" ? ", kept from the refund." : booking.cancellationFeeStatus === "collected" ? ", collected." : ", waived."}` : "Cancelled. No cancellation fee."}</p> : null}
        </div>
        <div className="ax-hero-side">
          <StatusBadge label={isBookingMissed(booking) ? "MISSED" : booking.status} />
          <span className="ax-hero-total">{formatPaise(booking.totalAmount)}</span>
          <StatusBadge label={booking.paymentStatus} />
        </div>
      </header>

      <div className="ax-detail">
        <div className="ax-detail-main">
          <BookingPanels booking={booking} job={job} service={service} bayName={bayName} onError={setError} />

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
            <div className="kv"><span>Booking ID</span><span className="ax-data">{bookingCode(booking.id)}</span></div>
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
