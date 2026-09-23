"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToBookings } from "../../../lib/bookings-service";
import { listenToJobs } from "../../../lib/jobs-service";
import { listenToPayments } from "../../../lib/payments-service";
import { listenToPendingApprovals, listenToExpiringMemberships, listenToTodayAttendance, listenToLowStock, listenToPendingPapers } from "../../../lib/dashboard-service";
import { studioToday } from "../../../lib/format";
import { DashboardView } from "../../../experience/DashboardView";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { Booking, ServiceJob, Payment, ApprovalRequest, Membership } from "@autodeck/core";

export default function DashboardPage() {
  const { claims } = useAdminAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [expiringMemberships, setExpiringMemberships] = useState<Membership[]>([]);
  const [staffPresent, setStaffPresent] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [pendingPapers, setPendingPapers] = useState(0);

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

  const today = studioToday();

  const stats = useMemo(() => {
    const todaysBookings = bookings.filter((b) => b.scheduledDate === today);
    const todaysJobs = jobs.filter((j) => j.scheduledDate === today);
    const activeJobs = jobs.filter((j) => j.status !== "DELIVERED" && j.status !== "CANCELLED");
    const completedToday = todaysJobs.filter((j) => j.status === "DELIVERED");
    const walkinsToday = todaysJobs.filter((j) => j.isWalkIn);
    const revenueToday = payments
      // Studio-day, not UTC-day: a payment at 1 am IST belongs to today.
      .filter((p) => p.status === "completed" && studioToday(new Date(p.createdAt)) === today)
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

    const floor = {
      arriving: jobs.filter((j) => j.status === "PENDING_VEHICLE" && j.scheduledDate === today).length,
      working: jobs.filter((j) => ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK"].includes(j.status)).length,
      ready: jobs.filter((j) => j.status === "READY_FOR_DELIVERY").length,
      delivered: completedToday.length,
    };

    return {
      floor,
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
    <DashboardView
      today={today}
      now={new Date()}
      revenueToday={stats.revenueToday}
      tiles={{ bookings: stats.todaysBookingsCount, active: stats.activeJobsCount, delivered: stats.completedTodayCount, walkins: stats.walkinsTodayCount, staffPresent }}
      floor={stats.floor}
      counts={{
        failedPayments: stats.failedPayments.length,
        unpaidDelivered: stats.unpaidCompletedJobs.length,
        pendingApprovals: pendingApprovals.length,
        staleJobs: stats.staleJobs.length,
        pendingPayments: stats.pendingPayments.length,
        expiringMemberships: stats.soonExpiring.length,
        lowStock,
        pendingPapers,
      }}
      onOpen={(href) => router.push(href)}
    />
  );
}
