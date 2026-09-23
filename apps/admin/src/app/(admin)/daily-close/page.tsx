"use client";

import { useCallback, useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { DailyClose } from "@autodeck/core";
import { getDailyClose, performDailyClose, type DayAggregates } from "../../../lib/office-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { DailyCloseView } from "../../../experience/DailyCloseView";

function kolkataToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default function DailyClosePage() {
  const { claims } = useAdminAuth();
  const [date, setDate] = useState(kolkataToday());
  const [close, setClose] = useState<DailyClose | null>(null);
  const [live, setLive] = useState<DayAggregates | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const studioId = claims?.studioId ?? FIRST_STUDIO_ID;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDailyClose(studioId, date);
      setClose(res.close);
      setLive(res.live);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't load the day.");
    } finally {
      setLoading(false);
    }
  }, [studioId, date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <DailyCloseView
      date={date}
      close={close}
      live={live}
      loading={loading}
      busy={busy}
      error={error}
      message={message}
      onDateChange={setDate}
      onClose={(countedCashPaise, notes, reclose) => {
        setBusy(true);
        setError(null);
        setMessage(null);
        performDailyClose({ studioId, date, countedCashPaise, ...(notes ? { notes } : {}), ...(reclose ? { reclose: true } : {}) })
          .then((r) => {
            setMessage(`Day closed. Variance ₹${(r.variancePaise / 100).toLocaleString("en-IN")}.`);
            return refresh();
          })
          .catch((err) => setError(err instanceof Error && err.message ? err.message : "Couldn't close the day."))
          .finally(() => setBusy(false));
      }}
    />
  );
}
