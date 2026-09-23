"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ServiceJob, JobStatus } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToJobs } from "../../../lib/jobs-service";
import { StatusBadge } from "../../../components/StatusBadge";
import { formatPaise, formatDateTime } from "../../../lib/format";
import { JobBoard, type BoardJob } from "../../../experience/JobBoard";
import { statusLabel } from "../../../lib/status-label";
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
  const [when, setWhen] = useState<"" | "today" | "upcoming">("today");
  const [view, setView] = useState<"board" | "list">("board");
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
      // "Today" means active today, not merely started today — a multi-day
      // job (e.g. a PPF service) started on an earlier date is still active
      // on every day through its estimatedEndDate. A car still in the studio
      // past its estimate stays on today's floor until delivered.
      const carriedOver = j.scheduledDate <= today && j.status !== "DELIVERED" && j.status !== "CANCELLED";
      if (when === "today" && !(carriedOver || (j.scheduledDate <= today && j.estimatedEndDate >= today))) return false;
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

  const activeToday = jobs.filter((j) => j.scheduledDate <= today && j.estimatedEndDate >= today);
  const inStudio = activeToday.filter((j) => ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK"].includes(j.status)).length;
  const ready = jobs.filter((j) => j.status === "READY_FOR_DELIVERY").length;
  const awaiting = activeToday.filter((j) => j.status === "PENDING_VEHICLE").length;

  const toBoard = (j: ServiceJob): BoardJob => ({
    id: j.id,
    status: j.status,
    plate: vehicleRegs[j.vehicleId] ?? "—",
    customer: customerNames[j.customerId] ?? "Customer",
    service: serviceNames[j.serviceId] ?? "Service",
    bay: j.bayId ? j.bayId.replace(/^bay[-_]?/i, "") : undefined,
    when: formatDateTime(j.scheduledAt),
    walkIn: j.isWalkIn,
    payment: j.paymentStatus,
  });
  const open = (id: string) => router.push(`/jobs/${id}`);

  return (
    <div className="ad-page">
      <header className="ad-page-head">
        <div>
          <p className="ad-label">Studio floor</p>
          <h1>Jobs</h1>
        </div>
        <div className="ad-kpis" aria-label="Today at a glance">
          <div><span className="ad-kpi-v">{awaiting}</span><span className="ad-label">Arriving today</span></div>
          <div><span className="ad-kpi-v ad-kpi-v--accent">{inStudio}</span><span className="ad-label">In the studio</span></div>
          <div><span className="ad-kpi-v ad-kpi-v--premium">{ready}</span><span className="ad-label">Ready for pickup</span></div>
        </div>
      </header>

      <div className="ad-toolbar">
        <div className="ad-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}>Board</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        </div>
        <div className="ad-seg" role="group" aria-label="Date">
          <button type="button" aria-pressed={when === "today"} onClick={() => setWhen("today")}>Today</button>
          <button type="button" aria-pressed={when === "upcoming"} onClick={() => setWhen("upcoming")}>Upcoming</button>
          <button type="button" aria-pressed={when === ""} onClick={() => setWhen("")}>All</button>
        </div>
        <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
          <option value="">Bookings and walk-ins</option>
          <option value="booking">Bookings only</option>
          <option value="walkin">Walk-ins only</option>
        </select>
        {view === "list" && (
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as JobStatus | "")}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        )}
        <input className="ad-search" type="search" aria-label="Search" placeholder="Search plate, customer or job" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="ad-count">{filtered.length} of {jobs.length}</span>
      </div>

      {loading ? (
        <JobBoard jobs={[]} loading onOpen={open} />
      ) : jobs.length === 0 ? (
        <div className="ad-empty">
          <p className="ad-title">No jobs yet</p>
          <p>Jobs appear here as bookings are confirmed and walk-ins are checked in.</p>
        </div>
      ) : view === "board" ? (
        <JobBoard jobs={filtered.map(toBoard)} onOpen={open} />
      ) : filtered.length === 0 ? (
        <div className="ad-empty"><p className="ad-title">No matches</p><p>Try another date, source or search.</p></div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Scheduled</th>
              <th>Status</th>
              <th>Vehicle</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Bay</th>
              <th>Payment</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => (
              <tr key={j.id} className="row-link" onClick={() => open(j.id)}>
                <td>{formatDateTime(j.scheduledAt)}{j.isWalkIn ? <span className="ad-muted"> · Walk-in</span> : null}</td>
                <td><StatusBadge label={j.status} /></td>
                <td className="ad-data">{vehicleRegs[j.vehicleId] ?? "—"}</td>
                <td>{customerNames[j.customerId] ?? "—"}</td>
                <td>{serviceNames[j.serviceId] ?? "—"}</td>
                <td>{j.bayId}</td>
                <td><StatusBadge label={j.paymentStatus} /></td>
                <td className="ad-data" style={{ textAlign: "right" }}>{formatPaise(j.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
