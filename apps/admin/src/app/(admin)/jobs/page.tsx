"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ServiceJob, JobStatus } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToJobs } from "../../../lib/jobs-service";
import { StatusBadge } from "../../../components/StatusBadge";
import { formatPaise, formatDateTime } from "../../../lib/format";
import { useLabels } from "../../../lib/use-labels";
import { COLLECTIONS } from "@autodeck/database";
import type { Customer, Vehicle, Service } from "@autodeck/core";

const STATUSES: JobStatus[] = ["PENDING_VEHICLE", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default function JobsPage() {
  const { claims } = useAdminAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<JobStatus | "">("");
  const [when, setWhen] = useState<"" | "today" | "upcoming">("");
  const [source, setSource] = useState<"" | "booking" | "walkin">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!claims) return undefined;
    setLoading(true);
    return listenToJobs(
      claims.tenantId,
      (data) => {
        setJobs(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [claims]);

  const customerNames = useLabels(COLLECTIONS.customers(), jobs.map((j) => j.customerId), (d) => (d as Customer).name);
  const vehicleRegs = useLabels(COLLECTIONS.vehicles(), jobs.map((j) => j.vehicleId), (d) => (d as Vehicle).registrationNumber);
  const serviceNames = useLabels(COLLECTIONS.services(), jobs.map((j) => j.serviceId), (d) => (d as Service).name);

  const today = todayIST();
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (status && j.status !== status) return false;
      if (when === "today" && j.scheduledDate !== today) return false;
      if (when === "upcoming" && j.scheduledDate <= today) return false;
      if (source === "booking" && j.isWalkIn) return false;
      if (source === "walkin" && !j.isWalkIn) return false;
      if (q) {
        const haystack = [j.id, j.customerId, j.vehicleId, customerNames[j.customerId], vehicleRegs[j.vehicleId]]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, status, when, source, search, today, customerNames, vehicleRegs]);

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Jobs</h1>

      <div className="filter-bar">
        <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus | "")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={when} onChange={(e) => setWhen(e.target.value as typeof when)}>
          <option value="">Any date</option>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
          <option value="">Booking + walk-in</option>
          <option value="booking">Booking only</option>
          <option value="walkin">Walk-in only</option>
        </select>
        <input placeholder="Search customer / vehicle / job ID" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260 }} />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtered.length} of {jobs.length}</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p>No jobs match these filters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Scheduled</th>
              <th>Status</th>
              <th>Source</th>
              <th>Customer</th>
              <th>Vehicle</th>
              <th>Service</th>
              <th>Bay</th>
              <th>Payment</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => (
              <tr key={j.id} className="row-link" onClick={() => router.push(`/jobs/${j.id}`)}>
                <td>{formatDateTime(j.scheduledAt)}</td>
                <td><StatusBadge label={j.status} /></td>
                <td>{j.isWalkIn ? "Walk-in" : "Booking"}</td>
                <td>{customerNames[j.customerId] ?? j.customerId}</td>
                <td>{vehicleRegs[j.vehicleId] ?? j.vehicleId}</td>
                <td>{serviceNames[j.serviceId] ?? j.serviceId}</td>
                <td>{j.bayId}</td>
                <td><StatusBadge label={j.paymentStatus} /></td>
                <td>{formatPaise(j.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
