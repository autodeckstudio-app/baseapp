"use client";

// Studio: the settings that shape booking. Opening hours, holidays, bays,
// GST. Hours and profile save together; holidays and bays save instantly.
import { useState } from "react";
import type { BayType, OperatingHours, StudioConfig } from "@autodeck/core";
import { PageHead } from "./Office";
import { formatDayLong } from "../lib/format";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BAY_NAME: Record<BayType, string> = { wash: "Wash", protection: "Protection", general: "General" };
// Monday-first reads like a shop week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface StudioProfile { name: string; timezone: string; taxRatePercent: string; hours: OperatingHours[] }

export function hoursProblem(hours: OperatingHours[]): string | null {
  for (const h of hours) {
    if (h.closed) continue;
    if (!/^\d{2}:\d{2}$/.test(h.open) || !/^\d{2}:\d{2}$/.test(h.close)) return `Set both times for ${DAYS[h.dayOfWeek]}.`;
    if (h.close <= h.open) return `${DAYS[h.dayOfWeek]} closes before it opens.`;
  }
  return null;
}

export function StudioView(p: {
  config: StudioConfig | null;
  loading: boolean;
  error: string | null;
  message: string | null;
  busy: boolean;
  onSaveProfile: (prof: StudioProfile) => void;
  onAddHoliday: (date: string) => void;
  onRemoveHoliday: (date: string) => void;
  onAddBay: (name: string, type: BayType) => void;
  onToggleBay: (bayId: string, active: boolean, name: string, type: BayType) => void;
}) {
  const cfg = p.config;
  const [prof, setProf] = useState<StudioProfile | null>(null);
  const [holiday, setHoliday] = useState("");
  const [bayName, setBayName] = useState("");
  const [bayType, setBayType] = useState<BayType>("wash");

  if (p.loading) return <div className="ad-page"><PageHead eyebrow="Office" title="Studio" /><div className="ad-skel" style={{ height: 320 }} /></div>;
  if (!cfg) return <div className="ad-page"><PageHead eyebrow="Office" title="Studio" /><div className="ad-panel ad-empty"><p className="ad-title">Studio not set up</p><p>{p.error ?? "No studio settings were found for this business."}</p></div></div>;

  const cur: StudioProfile = prof ?? { name: cfg.name, timezone: cfg.timezone, taxRatePercent: String(cfg.taxRatePercent), hours: cfg.operatingHours };
  const dirty = prof !== null;
  const tax = Number(cur.taxRatePercent);
  const problem = !cur.name.trim() ? "The studio needs a name." : !Number.isFinite(tax) || tax < 0 || tax > 40 ? "GST must be between 0 and 40%." : hoursProblem(cur.hours);
  const setHour = (day: number, patch: Partial<OperatingHours>) => setProf({ ...cur, hours: cur.hours.map((h) => (h.dayOfWeek === day ? { ...h, ...patch } : h)) });
  const openDays = cur.hours.filter((h) => !h.closed).length;
  const upcoming = [...cfg.holidays].sort();

  return (
    <div className="ad-page">
      <PageHead eyebrow="Office" title="Studio" kpis={[{ value: openDays, label: "Days open a week" }, { value: cfg.bays.filter((b) => b.active).length, label: "Bays in use", tone: "premium" }]} />
      {p.error && <p className="ad-status-msg ad-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ad-status-msg">{p.message}</p>}

      <div className="ad-detail">
        <div className="ad-detail-main">
          <form className="ad-panel" onSubmit={(e) => { e.preventDefault(); if (!problem) { p.onSaveProfile(cur); setProf(null); } }}>
            <span className="ad-label">Opening hours</span>
            <ul className="ad-hours">
              {WEEK_ORDER.map((d) => {
                const h = cur.hours.find((x) => x.dayOfWeek === d);
                if (!h) return null;
                return (
                  <li key={d} className={h.closed ? "is-closed" : undefined}>
                    <span className="ad-hours-day">{DAYS[d]}</span>
                    <label className="ad-switch">
                      <input type="checkbox" checked={!h.closed} onChange={(e) => setHour(d, { closed: !e.target.checked })} />
                      <span>{h.closed ? "Closed" : "Open"}</span>
                    </label>
                    {h.closed ? <span className="ad-sub">No bookings</span> : (
                      <span className="ad-hours-times">
                        <input type="time" value={h.open} onChange={(e) => setHour(d, { open: e.target.value })} aria-label={`${DAYS[d]} opens`} />
                        <span className="ad-sub">to</span>
                        <input type="time" value={h.close} onChange={(e) => setHour(d, { close: e.target.value })} aria-label={`${DAYS[d]} closes`} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="ad-label ad-form-section">Business</p>
            <div className="ad-form-pair">
              <label className="ad-form-row"><span>Studio name</span><input value={cur.name} onChange={(e) => setProf({ ...cur, name: e.target.value })} /></label>
              <label className="ad-form-row"><span>GST (%)</span><input inputMode="decimal" value={cur.taxRatePercent} onChange={(e) => setProf({ ...cur, taxRatePercent: e.target.value })} /></label>
            </div>
            <label className="ad-form-row"><span>Time zone</span>
              <select value={cur.timezone} onChange={(e) => setProf({ ...cur, timezone: e.target.value })}>
                {Array.from(new Set([cur.timezone, "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London"])).map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
              </select>
            </label>
            {problem && <p className="ad-note" style={{ color: "var(--ad-warning)" }}>{problem}</p>}
            <div className="ad-panel-actions">
              <button type="submit" className="ad-button ad-button--primary" disabled={!dirty || !!problem || p.busy}>Save changes</button>
              {dirty && <button type="button" className="ad-button" onClick={() => setProf(null)}>Discard</button>}
            </div>
          </form>
        </div>

        <aside className="ad-detail-side">
          <section className="ad-panel">
            <span className="ad-label">Holidays</span>
            {upcoming.length === 0 ? <p className="ad-note" style={{ marginTop: 0 }}>No holidays set.</p> : (
              <ul className="ad-chips-list">
                {upcoming.map((d) => (
                  <li key={d} className="ad-chip ad-chip--removable">
                    {formatDayLong(d)}
                    <button type="button" aria-label={`Remove ${d}`} disabled={p.busy} onClick={() => p.onRemoveHoliday(d)}>×</button>
                  </li>
                ))}
              </ul>
            )}
            <form className="ad-inline-form" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (holiday) { p.onAddHoliday(holiday); setHoliday(""); } }}>
              <input type="date" value={holiday} onChange={(e) => setHoliday(e.target.value)} aria-label="Holiday date" />
              <button type="submit" className="ad-button" disabled={!holiday || cfg.holidays.includes(holiday) || p.busy}>Add</button>
            </form>
          </section>

          <section className="ad-panel">
            <span className="ad-label">Bays</span>
            <ul className="ad-people">
              {cfg.bays.map((b) => (
                <li key={b.id} className={`ad-bay${b.active ? "" : " is-past"}`}>
                  <span className="ad-person-main">
                    <span className="ad-person-name">{b.name}</span>
                    <span className="ad-sub">{BAY_NAME[b.bayType]}{b.active ? "" : " · not in use"}</span>
                  </span>
                  <button type="button" className="ad-button" disabled={p.busy} onClick={() => p.onToggleBay(b.id, b.active, b.name, b.bayType)}>{b.active ? "Take out" : "Put back"}</button>
                </li>
              ))}
            </ul>
            <form className="ad-bay-add" onSubmit={(e) => { e.preventDefault(); if (bayName.trim()) { p.onAddBay(bayName.trim(), bayType); setBayName(""); } }}>
              <input placeholder="Bay 5" value={bayName} onChange={(e) => setBayName(e.target.value)} aria-label="Bay name" />
              <select value={bayType} onChange={(e) => setBayType(e.target.value as BayType)} aria-label="Bay type">
                {(Object.keys(BAY_NAME) as BayType[]).map((t) => <option key={t} value={t}>{BAY_NAME[t]}</option>)}
              </select>
              <button type="submit" className="ad-button" disabled={!bayName.trim() || p.busy}>Add bay</button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
