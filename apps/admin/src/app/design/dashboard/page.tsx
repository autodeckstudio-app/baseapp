"use client";

// Static preview of the office dashboard (no data, no auth).
import { StaffShell } from "../../../experience/StaffShell";
import { DashboardView } from "../../../experience/DashboardView";
import { studioToday } from "../../../lib/format";
import "../../../experience/shell.css";

export default function DashboardPreview() {
  return (
    <StaffShell pathname="/dashboard" office role="admin" who="studio@autodeck.example" home="/design/dashboard" onSignOut={() => {}}>
      <DashboardView
        today={studioToday()}
        now={new Date()}
        revenueToday={2874900}
        tiles={{ bookings: 7, active: 5, delivered: 3, walkins: 2 }}
        floor={{ arriving: 2, working: 4, ready: 1, delivered: 3 }}
        counts={{ failedPayments: 1, unpaidDelivered: 1, pendingApprovals: 2, staleJobs: 0, pendingPayments: 1, expiringMemberships: 3 }}
        onOpen={() => {}}
      />
    </StaffShell>
  );
}
