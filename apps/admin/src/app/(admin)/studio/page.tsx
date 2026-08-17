"use client";

import { useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { StudioConfig, OperatingHours, BayType } from "@autodeck/core";
import {
  getStudioConfig,
  updateStudioSettings,
  addHoliday,
  removeHoliday,
  upsertBay,
} from "../../../lib/studio-service";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StudioSettingsPage() {
  const studioId = FIRST_STUDIO_ID;
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [hours, setHours] = useState<OperatingHours[]>([]);
  const [newHoliday, setNewHoliday] = useState("");
  const [bayName, setBayName] = useState("");
  const [bayType, setBayType] = useState<BayType>("wash");

  async function refresh() {
    setLoading(true);
    try {
      const cfg = await getStudioConfig(studioId);
      if (cfg) {
        setConfig(cfg);
        setName(cfg.name);
        setTimezone(cfg.timezone);
        setTaxRatePercent(cfg.taxRatePercent);
        setHours(cfg.operatingHours);
      }
    } catch {
      setError("Failed to load studio settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveSettings() {
    setError(null);
    setStatus(null);
    try {
      await updateStudioSettings({ studioId, name, timezone, taxRatePercent, operatingHours: hours });
      setStatus("Settings saved.");
      await refresh();
    } catch {
      setError("Failed to save settings.");
    }
  }

  async function handleAddHoliday() {
    if (!newHoliday) return;
    setError(null);
    try {
      await addHoliday(studioId, newHoliday);
      setNewHoliday("");
      await refresh();
    } catch {
      setError("Failed to add holiday. It may already exist.");
    }
  }

  async function handleRemoveHoliday(date: string) {
    if (!window.confirm(`Remove holiday ${date}?`)) return;
    setError(null);
    try {
      await removeHoliday(studioId, date);
      await refresh();
    } catch {
      setError("Failed to remove holiday.");
    }
  }

  async function handleAddBay() {
    if (!bayName.trim()) return;
    setError(null);
    try {
      await upsertBay({ studioId, name: bayName.trim(), bayType, active: true });
      setBayName("");
      await refresh();
    } catch {
      setError("Failed to add resource.");
    }
  }

  async function handleToggleBay(bayId: string, current: boolean, currentName: string, currentType: BayType) {
    setError(null);
    try {
      await upsertBay({ studioId, bayId, name: currentName, bayType: currentType, active: !current });
      await refresh();
    } catch {
      setError("Failed to update resource.");
    }
  }

  if (loading) return <p>Loading…</p>;
  if (!config) return <p className="error">Studio not found. Seed the emulator first.</p>;

  return (
    <div>
      <h1>Studio Settings</h1>
      {error && <p className="error">{error}</p>}
      {status && <p>{status}</p>}

      <section>
        <h2>Profile</h2>
        <fieldset>
          <label>
            Name
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </fieldset>
        <fieldset>
          <label>
            Timezone
            <br />
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </label>
        </fieldset>
        <fieldset>
          <label>
            Tax rate (%)
            <br />
            <input
              type="number"
              value={taxRatePercent}
              onChange={(e) => setTaxRatePercent(Number(e.target.value))}
            />
          </label>
        </fieldset>
      </section>

      <section>
        <h2>Operating Hours</h2>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Open</th>
              <th>Close</th>
              <th>Closed</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((h, i) => (
              <tr key={h.dayOfWeek}>
                <td>{DAY_LABELS[h.dayOfWeek]}</td>
                <td>
                  <input
                    type="time"
                    value={h.open}
                    onChange={(e) => {
                      const next = [...hours];
                      next[i] = { ...h, open: e.target.value };
                      setHours(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={h.close}
                    onChange={(e) => {
                      const next = [...hours];
                      next[i] = { ...h, close: e.target.value };
                      setHours(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={h.closed}
                    onChange={(e) => {
                      const next = [...hours];
                      next[i] = { ...h, closed: e.target.checked };
                      setHours(next);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <button onClick={() => void saveSettings()}>Save studio settings</button>

      <section>
        <h2>Holidays</h2>
        <ul>
          {config.holidays.map((d) => (
            <li key={d}>
              {d} <button onClick={() => void handleRemoveHoliday(d)}>Remove</button>
            </li>
          ))}
        </ul>
        <input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} />
        <button onClick={() => void handleAddHoliday()}>Add holiday</button>
      </section>

      <section>
        <h2>Resources / Bays</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {config.bays.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.bayType}</td>
                <td>{b.active ? "Yes" : "No"}</td>
                <td>
                  <button onClick={() => void handleToggleBay(b.id, b.active, b.name, b.bayType)}>
                    {b.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <fieldset>
          <input placeholder="Bay name" value={bayName} onChange={(e) => setBayName(e.target.value)} />
          <select value={bayType} onChange={(e) => setBayType(e.target.value as BayType)}>
            <option value="wash">wash</option>
            <option value="protection">protection</option>
            <option value="general">general</option>
          </select>
          <button onClick={() => void handleAddBay()}>Add resource</button>
        </fieldset>
      </section>
    </div>
  );
}
