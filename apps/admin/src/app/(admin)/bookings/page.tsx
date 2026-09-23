"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking, BookingStatus } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToBookings } from "../../../lib/bookings-service";
import { StatusBadge } from "../../../components/StatusBadge";
import { formatPaise, formatDateTime, formatTime, formatDayLong, shiftDay, studioToday } from "../../../lib/format";
import { statusLabel } from "../../../lib/status-label";
import { DayAgenda, type AgendaItem } from "../../../experience/DayAgenda";
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
  const today = studioToday();
  const [date, setDate] = useState(today);
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

  const dayMode = date !== "";
  const sorted = [...filtered].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const dayCount = bookings.filter((b) => b.scheduledDate === date && b.status !== "CANCELLED" && b.status !== "EXPIRED").length;
  const pending = bookings.filter((b) => b.status === "PENDING").length;
  const upcoming = bookings.filter((b) => b.scheduledDate > today && (b.status === "CONFIRMED" || b.status === "PENDING")).length;
  const open = (id: string) => router.push(`/bookings/${id}`);
  const toItem = (b: Booking): AgendaItem => ({
    id: b.id,
    time: formatTime(b.scheduledAt),
    endTime: b.estimatedEndDate === b.scheduledDate ? formatTime(b.estimatedEndAt) : undefined,
    plate: vehicleRegs[b.vehicleId] ?? "—",
    customer: customerNames[b.customerId] ?? "Customer",
    service: serviceNames[b.serviceId] ?? "Service",
    bay: b.bayId ? b.bayId.replace(/^bay[-_]?/i, "") : undefined,
    status: b.status,
    payment: b.paymentStatus,
    amount: formatPaise(b.totalAmount),
  });

  return (
    <div className="ad-page">
      <header className="ad-page-head">
        <div>
          <p className="ad-label">Studio schedule</p>
          <h1>Bookings</h1>
        </div>
        <div className="ad-kpis" aria-label="At a glance">
          <div><span className="ad-kpi-v">{dayMode ? dayCount : bookings.length}</span><span className="ad-label">{dayMode ? "On this day" : "All bookings"}</span></div>
          <div><span className="ad-kpi-v ad-kpi-v--accent">{pending}</span><span className="ad-label">Need confirming</span></div>
          <div><span className="ad-kpi-v ad-kpi-v--premium">{upcoming}</span><span className="ad-label">Coming up</span></div>
        </div>
      </header>

      <div className="ad-toolbar">
        {dayMode ? (
          <div className="ad-daynav" role="group" aria-label="Day">
            <button type="button" className="ad-button" aria-label="Previous day" onClick={() => setDate(shiftDay(date, -1))}>‹</button>
            <span className="ad-daynav-date" aria-live="polite">{date === today ? "Today" : formatDayLong(date)}</span>
            <button type="button" className="ad-button" aria-label="Next day" onClick={() => setDate(shiftDay(date, 1))}>›</button>
            {date !== today && <button type="button" className="ad-button" onClick={() => setDate(today)}>Today</button>}
          </div>
        ) : null}
        <div className="ad-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={dayMode} onClick={() => setDate(today)}>Day</button>
          <button type="button" aria-pressed={!dayMode} onClick={() => setDate("")}>All dates</button>
        </div>
        <input type="date" aria-label="Pick a date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | "")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
        <select aria-label="Service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">All services</option>
          {serviceIds.map((s) => (
            <option key={s} value={s}>{serviceNames[s] ?? "Service"}</option>
          ))}
        </select>
        <input className="ad-search" type="search" aria-label="Search" placeholder="Search plate, customer or booking" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="ad-count">{filtered.length} of {bookings.length}</span>
      </div>

      {dayMode ? (
        <DayAgenda items={sorted.map(toItem)} loading={loading} onOpen={open} />
      ) : loading ? (
        <DayAgenda items={[]} loading onOpen={open} />
      ) : sorted.length === 0 ? (
        <div className="ad-empty"><p className="ad-title">No matches</p><p>Try another status, service or search.</p></div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Status</th>
              <th>Vehicle</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Bay</th>
              <th>Payment</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => (
              <tr key={b.id} className="row-link" onClick={() => open(b.id)}>
                <td>{formatDateTime(b.scheduledAt)}</td>
                <td><StatusBadge label={b.status} /></td>
                <td className="ad-data">{vehicleRegs[b.vehicleId] ?? "—"}</td>
                <td>{customerNames[b.customerId] ?? "—"}</td>
                <td>{serviceNames[b.serviceId] ?? "—"}</td>
                <td>{b.bayId}</td>
                <td><StatusBadge label={b.paymentStatus} /></td>
                <td className="ad-data" style={{ textAlign: "right" }}>{formatPaise(b.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
