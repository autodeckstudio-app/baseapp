"use client";

import { useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { StudioConfig } from "@autodeck/core";
import { StudioView } from "../../../experience/StudioView";
import {
  getStudioConfig,
  updateStudioSettings,
  addHoliday,
  removeHoliday,
  upsertBay,
} from "../../../lib/studio-service";


export default function StudioSettingsPage() {
  const studioId = FIRST_STUDIO_ID;
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const cfg = await getStudioConfig(studioId);
      setConfig(cfg ?? null);
    } catch {
      setError("Couldn't load studio settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Each write is a server callable that re-checks the admin role.
  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await action();
      setStatus(ok);
      await refresh();
    } catch {
      setError(fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudioView
      config={config}
      loading={loading}
      error={error}
      message={status}
      busy={busy}
      onSaveProfile={(prof) =>
        void run(
          () => updateStudioSettings({ studioId, name: prof.name.trim(), timezone: prof.timezone, taxRatePercent: Number(prof.taxRatePercent), operatingHours: prof.hours }),
          "Studio saved. New bookings follow these hours.",
          "Couldn't save the studio settings.",
        )
      }
      onAddHoliday={(d) => void run(() => addHoliday(studioId, d), "Holiday added. No bookings can be made that day.", "Couldn't add that holiday. It may already be set.")}
      onRemoveHoliday={(d) => void run(() => removeHoliday(studioId, d), "Holiday removed.", "Couldn't remove that holiday.")}
      onAddBay={(n, t) => void run(() => upsertBay({ studioId, name: n, bayType: t, active: true }), `${n} added.`, "Couldn't add the bay.")}
      onToggleBay={(id, active, n, t) => void run(() => upsertBay({ studioId, bayId: id, name: n, bayType: t, active: !active }), active ? `${n} taken out of use.` : `${n} is back in use.`, "Couldn't update the bay.")}
    />
  );
}
