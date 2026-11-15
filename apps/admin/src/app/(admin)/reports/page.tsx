"use client";

import { useCallback, useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { getOfficeReport, type OfficeReport } from "../../../lib/office-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { ReportsView } from "../../../experience/ReportsView";

function kolkataMonth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
}

export default function ReportsPage() {
  const { claims } = useAdminAuth();
  const [month, setMonth] = useState(kolkataMonth());
  const [report, setReport] = useState<OfficeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const studioId = claims?.studioId ?? FIRST_STUDIO_ID;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getOfficeReport(studioId, month));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't build the report.");
    } finally {
      setLoading(false);
    }
  }, [studioId, month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ReportsView
      month={month}
      report={report}
      loading={loading}
      error={error}
      onMonthChange={setMonth}
    />
  );
}
