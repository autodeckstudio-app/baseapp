"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { getOfficeReport, type OfficeReport } from "../../../lib/office-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { ReportsView } from "../../../experience/ReportsView";

function kolkataMonth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
}

export default function ReportsPage() {
  const generation = useRef(0);
  const { claims } = useAdminAuth();
  const [month, setMonth] = useState(kolkataMonth());
  const [report, setReport] = useState<OfficeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const studioId = claims?.studioId ?? FIRST_STUDIO_ID;

  const refresh = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const result = await getOfficeReport(studioId, month);
      if (version !== generation.current) return;
      if (result.studioId !== studioId || result.month !== month) throw Error("Report scope needs review.");
      setReport(result);
    } catch (err) {
      if (version === generation.current) {
        setReport(null);
        setError(err instanceof Error && err.message ? err.message : "Couldn't build the report.");
      }
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [studioId, month]);

  useEffect(() => {
    void refresh();
    return () => { generation.current++; };
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
