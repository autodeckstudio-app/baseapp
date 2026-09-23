"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuditLog, Employee } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToAuditLog } from "../../../lib/audit-service";
import { listStaff } from "../../../lib/staff-service";
import { AuditView } from "../../../experience/OfficeViews";

export default function AuditPage() {
  const { claims } = useAdminAuth();
  const [entries, setEntries] = useState<AuditLog[]>([]);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!claims) return undefined;
    setLoading(true);
    listStaff(claims.tenantId).then(setStaff).catch(() => setStaff([]));
    return listenToAuditLog(
      claims.tenantId,
      (data) => {
        setEntries(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [claims]);

  // Show a person's name where the roster knows their account.
  const who = useMemo(() => {
    const m: Record<string, string> = { system: "AutoDeck (automatic)" };
    for (const s of staff) if (s.authUid) m[s.authUid] = s.name;
    return m;
  }, [staff]);

  return <AuditView entries={entries} loading={loading} error={error} who={who} />;
}
