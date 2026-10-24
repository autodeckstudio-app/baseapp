"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../lib/auth-context";
import { listenToStaffAlerts, type StaffAlert } from "../lib/staff-alerts-service";

export function useStaffAlerts(): StaffAlert[] {
  const { claims } = useAdminAuth();
  const [alerts, setAlerts] = useState<StaffAlert[]>([]);
  useEffect(() => {
    if (!claims) return undefined;
    return listenToStaffAlerts({ tenantId: claims.tenantId, studioId: claims.studioId, role: claims.role }, setAlerts, () => setAlerts([]));
  }, [claims]);
  return alerts;
}

/** Count only: no customer details. Persistent, read-only. */
const TEXT: Record<string, (n: number) => string> = {
  ambiguous_payment_link: (n) => `${n === 1 ? "1 online payment notice matched" : `${n} online payment notices matched`} more than one payment, so ${n === 1 ? "it was" : "they were"} not applied automatically. A manual check is needed.`,
  late_membership_payment: (n) => `${n === 1 ? "1 payment arrived" : `${n} payments arrived`} for a membership that was already cancelled or expired. A full refund request was recorded.`,
  late_membership_already_reserved: (n) => `${n === 1 ? "1 payment arrived" : `${n} payments arrived`} for a membership that was already cancelled or expired. A matching full refund request already existed.`,
  refund_event_pending: (n) => `${n === 1 ? "1 refund update" : `${n} refund updates`} from Razorpay ${n === 1 ? "is" : "are"} waiting to be matched to our refund record. Nothing was changed. If this stays, a manual check is needed.`,
  refund_pending_truncated: (n) => `${n === 1 ? "1 payment has" : `${n} payments have`} more waiting Razorpay refund updates than were checked at once. The rest are still waiting. A manual check is needed.`,
  refund_processed_unmatched: (n) => `${n === 1 ? "1 refund" : `${n} refunds`} reported as processed by Razorpay did not match our stored refund record. Nothing was changed. A manual check is needed.`,
  late_membership_refund_not_reserved: (n) => `Refund owed, NOT reserved: ${n === 1 ? "1 payment arrived" : `${n} payments arrived`} for a membership that was already cancelled or expired, and a different refund request blocks the full refund. Manual action is required; nothing resolves this automatically.`,
};

/** Count per kind only: no customer details. Persistent, read-only. */
export function StaffAlertsNotice() {
  const alerts = useStaffAlerts();
  if (alerts.length === 0) return null;
  const kinds = Array.from(new Set(alerts.map((a) => a.kind)));
  return (
    <div className="ax-panel" role="status" data-testid="staff-alerts-notice">
      <span className="ax-label">Needs a manual check</span>
      {kinds.map((k) => (
        <p key={k} style={{ margin: "4px 0 0" }}>{(TEXT[k] ?? (() => "An automatic step needs a manual check."))(alerts.filter((a) => a.kind === k).length)}</p>
      ))}
    </div>
  );
}
