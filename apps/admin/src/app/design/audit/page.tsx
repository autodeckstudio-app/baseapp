"use client";

// Static preview (no data, no auth). Sample records only.
import { StaffShell } from "../../../experience/StaffShell";
import "../../../experience/shell.css";
import type { AuditLog } from "@autodeck/core";
import { AuditView } from "../../../experience/OfficeViews";

const A = (id: string, action: string, entityType: string, entityId: string, performedBy: string, performedByRole: string, mins: number) => ({ id, action, entityType, entityId, performedBy, performedByRole, studioId: "main", createdAt: new Date(Date.now() - mins * 60000).toISOString(), before: { status: "VEHICLE_RECEIVED" }, after: { status: "IN_PROGRESS" } }) as unknown as AuditLog;
const ROWS = [
  A("1", "JOB_STATUS_CHANGED", "job", "job_8f21c", "u1", "studio", 4),
  A("2", "PAYMENT_RECORDED", "payment", "pay_71ad0", "u2", "admin", 22),
  A("3", "BOOKING_CONFIRMED", "booking", "bk_03e9a", "system", "system", 48),
  A("4", "STAFF_ROLE_CHANGED", "employee", "emp_1c2", "u2", "admin", 300),
];

export default function Preview() {
  return (
    <StaffShell pathname="/audit" office role="admin" who="studio@autodeck.example" home="/design/audit" onSignOut={() => {}}>
      <AuditView entries={ROWS} loading={false} error={null} who={{ u1: "Vikram (floor)", u2: "Owner", system: "AutoDeck (automatic)" }} />
    </StaffShell>
  );
}
