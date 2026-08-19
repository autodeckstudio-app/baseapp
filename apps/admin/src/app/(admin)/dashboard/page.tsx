"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToBookings } from "../../../lib/bookings-service";
import { listenToJobs } from "../../../lib/jobs-service";
import { listenToPayments } from "../../../lib/payments-service";
import { listenToPendingApprovals, listenToExpiringMemberships } from "../../../lib/dashboard-service";
import { colors, spacing, radius } from "@autodeck/ui/tokens";
import { formatPaise, formatDate } from "../../../lib/format";
import type { Booking, ServiceJob, Payment, ApprovalRequest, Membership } from "@autodeck/core";

const SECTIONS = [
  { href: "/studio", label: "Studio Settings", description: "Operating hours, holidays, bays and resources." },
  { href: "/services", label: "Service Catalogue", description: "Services, pricing, and vehicle category rules." },
  { href: "/memberships", label: "Membership Plans", description: "Tiers, pricing, included washes, and discounts." },
  { href: "/vehicles", label: "Vehicle Lookup", description: "Look up a vehicle and manage its protection records." },
  { href: "/staff", label: "Staff", description: "Studio and admin accounts, roles, and access." },
];

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default function DashboardPage() {
  const { claims } = useAdminAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [expiringMemberships, setExpiringMemberships] = useState<Membership[]>([]);

  useEffect(() => {
    if (!claims) return undefined;
    const unsubs = [
      listenToBookings(claims.tenantId, setBookings, () => undefined),
      listenToJobs(claims.tenantId, setJobs, () => undefined),
      listenToPayments(claims.tenantId, setPayments, () => undefined),
      listenToPendingApprovals(claims.tenantId, setPendingApprovals, () => undefined),
      listenToExpiringMemberships(claims.tenantId, setExpiringMemberships, () => undefined),
    ];
    return () => unsubs.forEach((u) => u());
  }, [claims]);

  const today = todayIST();

  const stats = useMemo(() => {
    const todaysBookings = bookings.filter((b) => b.scheduledDate === today);
    const todaysJobs = jobs.filter((j) => j.scheduledDate === today);
    const activeJobs = jobs.filter((j) => j.status !== "DELIVERED" && j.status !== "CANCELLED");
    const completedToday = todaysJobs.filter((j) => j.status === "DELIVERED");
    const walkinsToday = todaysJobs.filter((j) => j.isWalkIn);
    const revenueToday = payments
      .filter((p) => p.status === "completed" && p.createdAt.slice(0, 10) === today)
      .reduce((sum, p) => sum + p.amount, 0);
    const pendingPayments = payments.filter((p) => p.status === "pending" || p.status === "processing");
    const failedPayments = payments.filter((p) => p.status === "failed");
    const unpaidCompletedJobs = jobs.filter((j) => j.status === "DELIVERED" && j.paymentStatus === "unpaid");
    const staleCutoff = Date.now() - 48 * 3600_000;
    const staleJobs = jobs.filter((j) => {
      if (!["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK"].includes(j.status)) return false;
      if (new Date(j.updatedAt).getTime() >= staleCutoff) return false;
      // A multi-day job (e.g. a PPF service) is expected to sit unchanged
      // for days while genuinely in progress — only flag it once it's run
      // past its own estimated completion date, not merely because 48h
      // passed without a status change.
      if (j.scheduledDate !== j.estimatedEndDate) return j.estimatedEndDate < today;
      return true;
    });
    const soonExpiring = expiringMemberships.filter((m) => m.endDate && m.endDate <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

    return {
      todaysBookingsCount: todaysBookings.length,
      activeJobsCount: activeJobs.length,
      completedTodayCount: completedToday.length,
      walkinsTodayCount: walkinsToday.length,
      revenueToday,
      pendingPayments,
      failedPayments,
      unpaidCompletedJobs,
      staleJobs,
      soonExpiring,
    };
  }, [bookings, jobs, payments, expiringMemberships, today]);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>{claims?.role} · tenant: {claims?.tenantId} · {formatDate(new Date().toISOString())}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: spacing.md, marginBottom: spacing.xl }}>
        <Tile value={stats.todaysBookingsCount} label="Bookings today" onClick={() => router.push("/bookings")} />
        <Tile value={stats.activeJobsCount} label="Active jobs" onClick={() => router.push("/jobs")} />
        <Tile value={stats.completedTodayCount} label="Completed today" onClick={() => router.push("/jobs")} />
        <Tile value={pendingApprovals.length} label="Pending approvals" onClick={() => router.push("/jobs")} />
        <Tile value={stats.pendingPayments.length} label="Pending payments" onClick={() => router.push("/payments")} />
        <Tile value={formatPaise(stats.revenueToday)} label="Revenue today" onClick={() => router.push("/payments")} />
        <Tile value={stats.walkinsTodayCount} label="Walk-ins today" onClick={() => router.push("/jobs")} />
      </div>

      <h2>Alerts</h2>
      {stats.failedPayments.length === 0 &&
      pendingApprovals.length === 0 &&
      stats.unpaidCompletedJobs.length === 0 &&
      stats.staleJobs.length === 0 &&
      stats.soonExpiring.length === 0 ? (
        <p style={{ color: colors.textMuted, fontSize: 13 }}>No operational alerts.</p>
      ) : (
        <div style={{ marginBottom: spacing.xl }}>
          {pendingApprovals.length > 0 && (
            <div className="alert-banner" style={{ background: colors.warningMuted, color: colors.warning }}>
              {pendingApprovals.length} approval{pendingApprovals.length === 1 ? "" : "s"} awaiting customer response.
            </div>
          )}
          {stats.failedPayments.length > 0 && (
            <div className="alert-banner" style={{ background: colors.errorMuted, color: colors.error }}>
              {stats.failedPayments.length} failed payment{stats.failedPayments.length === 1 ? "" : "s"}.{" "}
              <Link href="/payments">Review</Link>
            </div>
          )}
          {stats.unpaidCompletedJobs.length > 0 && (
            <div className="alert-banner" style={{ background: colors.errorMuted, color: colors.error }}>
              {stats.unpaidCompletedJobs.length} completed job{stats.unpaidCompletedJobs.length === 1 ? "" : "s"} still unpaid.{" "}
              <Link href="/jobs">Review</Link>
            </div>
          )}
          {stats.staleJobs.length > 0 && (
            <div className="alert-banner" style={{ background: colors.warningMuted, color: colors.warning }}>
              {stats.staleJobs.length} job{stats.staleJobs.length === 1 ? "" : "s"} unchanged for over 48 hours.{" "}
              <Link href="/jobs">Review</Link>
            </div>
          )}
          {stats.soonExpiring.length > 0 && (
            <div className="alert-banner" style={{ background: colors.warningMuted, color: colors.warning }}>
              {stats.soonExpiring.length} membership{stats.soonExpiring.length === 1 ? "" : "s"} expiring within 7 days.
            </div>
          )}
        </div>
      )}

      <h2>Configuration</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: spacing.lg }}>
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              display: "block",
              padding: spacing.lg,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              textDecoration: "none",
              color: colors.textPrimary,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: spacing.xs }}>{s.label}</div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>{s.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Tile({ value, label, onClick }: { value: number | string; label: string; onClick: () => void }) {
  return (
    <div className="stat-tile row-link" onClick={onClick}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
