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
export function StaffAlertsNotice() {
  const alerts = useStaffAlerts();
  if (alerts.length === 0) return null;
  return (
    <div className="ax-panel" role="status" data-testid="staff-alerts-notice">
      <span className="ax-label">Needs a manual check</span>
      <p style={{ margin: "4px 0 0" }}>{alerts.length === 1 ? "1 online payment notice matched more than one payment, so it was not applied automatically." : `${alerts.length} online payment notices matched more than one payment, so they were not applied automatically.`} A manual check is needed.</p>
    </div>
  );
}
