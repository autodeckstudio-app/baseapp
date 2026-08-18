"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Customer, Vehicle, Booking, ServiceJob, Membership, Payment, Invoice, Warranty, Protection, Notification, AuditLog } from "@autodeck/core";
import { useAdminAuth } from "../../../../lib/auth-context";
import {
  listenToCustomer,
  listenToCustomerVehicles,
  listenToCustomerBookings,
  listenToCustomerJobs,
  listenToCustomerMemberships,
  listenToCustomerPayments,
  listenToCustomerInvoices,
  listenToCustomerNotifications,
  listenToCustomerAudit,
  getWarrantiesForVehicles,
  getProtectionsForVehicles,
} from "../../../../lib/customers-service";
import { StatusBadge } from "../../../../components/StatusBadge";
import { formatPaise, formatDateTime, formatDate } from "../../../../lib/format";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { claims } = useAdminAuth();

  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [protections, setProtections] = useState<Array<Protection & { vehicleId: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    return listenToCustomer(id, setCustomer, (err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!id || !claims) return undefined;
    const unsubs = [
      listenToCustomerVehicles(id, claims.tenantId, setVehicles, (err) => setError(err.message)),
      listenToCustomerBookings(id, claims.tenantId, setBookings, (err) => setError(err.message)),
      listenToCustomerJobs(id, claims.tenantId, setJobs, (err) => setError(err.message)),
      listenToCustomerMemberships(id, claims.tenantId, setMemberships, (err) => setError(err.message)),
      listenToCustomerPayments(id, claims.tenantId, setPayments, (err) => setError(err.message)),
      listenToCustomerInvoices(id, claims.tenantId, setInvoices, (err) => setError(err.message)),
      listenToCustomerNotifications(id, claims.tenantId, setNotifications, (err) => setError(err.message)),
      listenToCustomerAudit(id, claims.tenantId, setAudit, (err) => setError(err.message)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [id, claims]);

  useEffect(() => {
    if (!id || !claims || vehicles.length === 0) return;
    const vehicleIds = vehicles.map((v) => v.id);
    void getWarrantiesForVehicles(vehicleIds, claims.tenantId, id).then(setWarranties);
    void getProtectionsForVehicles(vehicleIds).then(setProtections);
  }, [id, claims, vehicles]);

  if (error) return <p className="error">{error}</p>;
  if (customer === undefined) return <p>Loading…</p>;
  if (customer === null) return <p>Customer not found.</p>;

  return (
    <div>
      <button onClick={() => router.push("/customers")}>&larr; Customers</button>
      <h1>{customer.name}</h1>
      <p>{customer.phone} · joined {formatDate(customer.createdAt)}</p>

      <h2>Vehicles ({vehicles.length})</h2>
      {vehicles.length === 0 ? <p>No vehicles on file.</p> : (
        <table>
          <thead><tr><th>Vehicle</th><th>Registration</th><th>Category</th></tr></thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td>{v.year} {v.make} {v.model}</td>
                <td>{v.registrationNumber}</td>
                <td>{v.category ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Bookings ({bookings.length})</h2>
      {bookings.length === 0 ? <p>No bookings.</p> : (
        <table>
          <thead><tr><th>Scheduled</th><th>Status</th><th>Amount</th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="row-link" onClick={() => router.push(`/bookings/${b.id}`)}>
                <td>{formatDateTime(b.scheduledAt)}</td>
                <td><StatusBadge label={b.status} /></td>
                <td>{formatPaise(b.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Jobs ({jobs.length})</h2>
      {jobs.length === 0 ? <p>No jobs.</p> : (
        <table>
          <thead><tr><th>Scheduled</th><th>Status</th><th>Total</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="row-link" onClick={() => router.push(`/jobs/${j.id}`)}>
                <td>{formatDateTime(j.scheduledAt)}</td>
                <td><StatusBadge label={j.status} /></td>
                <td>{formatPaise(j.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Memberships ({memberships.length})</h2>
      {memberships.length === 0 ? <p>No memberships.</p> : (
        <table>
          <thead><tr><th>Tier</th><th>Status</th><th>Washes</th><th>Valid until</th></tr></thead>
          <tbody>
            {memberships.map((m) => (
              <tr key={m.id}>
                <td>{m.tier}</td>
                <td><StatusBadge label={m.status} /></td>
                <td>{m.washesUsed}/{m.washesTotal}</td>
                <td>{formatDate(m.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Payments ({payments.length})</h2>
      {payments.length === 0 ? <p>No payments.</p> : (
        <table>
          <thead><tr><th>Date</th><th>Status</th><th>Method</th><th>Amount</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{formatDateTime(p.createdAt)}</td>
                <td><StatusBadge label={p.status} /></td>
                <td>{p.method}</td>
                <td>{formatPaise(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Invoices ({invoices.length})</h2>
      {invoices.length === 0 ? <p>No invoices.</p> : (
        <table>
          <thead><tr><th>Number</th><th>Status</th><th>Total</th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="row-link" onClick={() => router.push(`/invoices/${inv.id}`)}>
                <td>{inv.invoiceNumber}</td>
                <td><StatusBadge label={inv.status} /></td>
                <td>{formatPaise(inv.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Warranties ({warranties.length})</h2>
      {warranties.length === 0 ? <p>No warranties.</p> : (
        <table>
          <thead><tr><th>Service</th><th>Ends</th><th>Sealed</th></tr></thead>
          <tbody>
            {warranties.map((w) => (
              <tr key={w.id}>
                <td>{w.warrantyLabel}</td>
                <td>{w.endDate ?? "No fixed term"}</td>
                <td>{formatDateTime(w.sealedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Protections ({protections.length})</h2>
      {protections.length === 0 ? <p>No protections on file.</p> : (
        <table>
          <thead><tr><th>Kind</th><th>Provider</th><th>Status</th><th>Expiry</th></tr></thead>
          <tbody>
            {protections.map((p) => (
              <tr key={p.id}>
                <td>{p.kind}</td>
                <td>{p.provider ?? "—"}</td>
                <td><StatusBadge label={p.status} /></td>
                <td>{p.expiryDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Notifications ({notifications.length})</h2>
      {notifications.length === 0 ? <p>No notifications.</p> : (
        <table>
          <thead><tr><th>Type</th><th>Body</th><th>Sent</th><th>Read</th></tr></thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id}>
                <td>{n.type}</td>
                <td>{n.body}</td>
                <td>{formatDateTime(n.createdAt)}</td>
                <td>{n.readAt ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Audit history</h2>
      {audit.length === 0 ? <p>No audit entries for this customer profile.</p> : (
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
