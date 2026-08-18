"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking, BookingStatus } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToBookings } from "../../../lib/bookings-service";
import { StatusBadge } from "../../../components/StatusBadge";
import { formatPaise, formatDateTime, formatDate } from "../../../lib/format";
import { useLabels } from "../../../lib/use-labels";
import { COLLECTIONS } from "@autodeck/database";
import type { Customer, Vehicle, Service } from "@autodeck/core";

const STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"];

export default function BookingsPage() {
  const { claims } = useAdminAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<BookingStatus | "">("");
  const [date, setDate] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!claims) return undefined;
    setLoading(true);
    return listenToBookings(
      claims.tenantId,
      (data) => {
        setBookings(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [claims]);

  const serviceIds = useMemo(() => Array.from(new Set(bookings.map((b) => b.serviceId))).sort(), [bookings]);
  const customerNames = useLabels(COLLECTIONS.customers(), bookings.map((b) => b.customerId), (d) => (d as Customer).name);
  const vehicleRegs = useLabels(COLLECTIONS.vehicles(), bookings.map((b) => b.vehicleId), (d) => (d as Vehicle).registrationNumber);
  const serviceNames = useLabels(COLLECTIONS.services(), bookings.map((b) => b.serviceId), (d) => (d as Service).name);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (status && b.status !== status) return false;
      if (date && b.scheduledDate !== date) return false;
      if (serviceId && b.serviceId !== serviceId) return false;
      if (q) {
        const haystack = [b.id, b.customerId, b.vehicleId, customerNames[b.customerId], vehicleRegs[b.vehicleId]]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, status, date, serviceId, search, customerNames, vehicleRegs]);

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Bookings</h1>

      <div className="filter-bar">
        <select value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | "")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">All services</option>
          {serviceIds.map((s) => (
            <option key={s} value={s}>{serviceNames[s] ?? s}</option>
          ))}
        </select>
        <input
          placeholder="Search customer / vehicle / booking ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtered.length} of {bookings.length}</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p>No bookings match these filters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Scheduled</th>
              <th>Status</th>
              <th>Customer</th>
              <th>Vehicle</th>
              <th>Service</th>
              <th>Bay</th>
              <th>Payment</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="row-link" onClick={() => router.push(`/bookings/${b.id}`)}>
                <td>{formatDateTime(b.scheduledAt)}</td>
                <td><StatusBadge label={b.status} /></td>
                <td>{customerNames[b.customerId] ?? b.customerId}</td>
                <td>{vehicleRegs[b.vehicleId] ?? b.vehicleId}</td>
                <td>{serviceNames[b.serviceId] ?? b.serviceId}</td>
                <td>{b.bayId}</td>
                <td><StatusBadge label={b.paymentStatus} /></td>
                <td>{formatPaise(b.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ marginTop: 8, fontSize: 11, color: "var(--color-text-muted)" }}>
        Showing scheduled slots as of {formatDate(new Date().toISOString())}. Live-updating.
      </p>
    </div>
  );
}
