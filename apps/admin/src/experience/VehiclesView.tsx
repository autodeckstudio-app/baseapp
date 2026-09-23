"use client";

// Vehicles: find a car by plate, see its papers (insurance, FASTag, PUC, RC,
// warranty) with how long each has left, and add or verify records.
import { useState } from "react";
import type { Vehicle, Protection, ProtectionKind, ProtectionStatus } from "@autodeck/core";
import { PageHead } from "./Office";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../lib/format";

export const KIND_LABEL: Record<ProtectionKind, string> = {
  insurance: "Insurance",
  fasttag: "FASTag",
  puc: "PUC certificate",
  rc: "Registration (RC)",
  extended_warranty: "Extended warranty",
  other: "Other",
};
const KINDS = Object.keys(KIND_LABEL) as ProtectionKind[];

export interface ProtectionDraft {
  kind: ProtectionKind;
  provider: string;
  policyNumber: string;
  startDate: string;
  expiryDate: string;
  notes: string;
}
const EMPTY: ProtectionDraft = { kind: "insurance", provider: "", policyNumber: "", startDate: "", expiryDate: "", notes: "" };

// Whole days from `today` to an ISO date; negative when past.
export function daysLeft(expiry: string, today: string): number {
  return Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

function Expiry({ date, today }: { date: string | null; today: string }) {
  if (!date) return <span className="ad-sub">No expiry on file</span>;
  const d = daysLeft(date, today);
  const tone = d < 0 ? "danger" : d <= 30 ? "warning" : "ok";
  const text = d < 0 ? `Expired ${-d} day${d === -1 ? "" : "s"} ago` : d === 0 ? "Expires today" : `${d} day${d === 1 ? "" : "s"} left`;
  return <span className={`ad-expiry ad-expiry--${tone}`}>{text} · {formatDate(date)}</span>;
}

export function VehiclesView(p: {
  today: string;
  searching: boolean;
  vehicle: Vehicle | null;
  protections: Protection[];
  error: string | null;
  message: string | null;
  onSearch: (plate: string) => void;
  onAdd: (draft: ProtectionDraft) => void;
  onStatus: (prot: Protection, status: ProtectionStatus) => void;
}) {
  const [plate, setPlate] = useState("");
  const [draft, setDraft] = useState<ProtectionDraft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const expiring = p.protections.filter((x) => x.expiryDate && daysLeft(x.expiryDate, p.today) <= 30).length;

  return (
    <div className="ad-page">
      <PageHead eyebrow="Office" title="Vehicles" />
      <form className="ad-panel ad-plate-search" onSubmit={(e) => { e.preventDefault(); p.onSearch(plate); }}>
        <span className="ad-label">Find a car</span>
        <div className="ad-plate-row">
          <input className="ad-plate-input" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="GJ 01 AB 1234" aria-label="Number plate" />
          <button type="submit" className="ad-button ad-button--primary" disabled={p.searching || plate.trim().length < 4}>{p.searching ? "Looking" : "Find"}</button>
        </div>
      </form>
      {p.error && <p className="ad-status-msg ad-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ad-status-msg">{p.message}</p>}

      {p.vehicle && (
        <>
          <div className="ad-hero" style={{ marginTop: "var(--ad-space-inset)" }}>
            <div>
              <p className="ad-label">{[p.vehicle.year, p.vehicle.make].filter(Boolean).join(" ")}</p>
              <h1>{p.vehicle.registrationNumber}</h1>
              <p className="ad-hero-sub">{[p.vehicle.make, p.vehicle.model].filter(Boolean).join(" ")}</p>
            </div>
            <div className="ad-kpis">
              <div><span className="ad-kpi-v">{p.protections.length}</span><span className="ad-label">Papers on file</span></div>
              <div><span className={`ad-kpi-v${expiring ? " ad-kpi-v--accent" : ""}`}>{expiring}</span><span className="ad-label">Due within 30 days</span></div>
            </div>
          </div>

          <div className="ad-detail">
            <div className="ad-detail-main">
              <section className="ad-panel">
                <span className="ad-label">Papers</span>
                {p.protections.length === 0 ? (
                  <p className="ad-note">Nothing on file for this car yet.</p>
                ) : (
                  <ul className="ad-papers">
                    {p.protections.map((x) => (
                      <li key={x.id} className="ad-paper">
                        <div className="ad-paper-main">
                          <span className="ad-person-name">{KIND_LABEL[x.kind]}</span>
                          <span className="ad-sub">{[x.provider, x.policyNumber].filter(Boolean).join(" · ") || "No provider details"}</span>
                          <Expiry date={x.expiryDate} today={p.today} />
                        </div>
                        <StatusBadge label={x.status} />
                        <select value={x.status} onChange={(e) => p.onStatus(x, e.target.value as ProtectionStatus)} aria-label={`Status of ${KIND_LABEL[x.kind]}`}>
                          <option value="unverified">Not checked</option>
                          <option value="verified">Checked</option>
                          <option value="expired">Expired</option>
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            <aside className="ad-detail-side">
              {adding ? (
                <form className="ad-panel" onSubmit={(e) => { e.preventDefault(); p.onAdd(draft); setDraft(EMPTY); setAdding(false); }}>
                  <span className="ad-label">Add a paper</span>
                  <label className="ad-form-row"><span>Type</span>
                    <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ProtectionKind })}>
                      {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                    </select>
                  </label>
                  <label className="ad-form-row"><span>Provider</span><input value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} placeholder="e.g. ICICI Lombard" /></label>
                  <label className="ad-form-row"><span>Policy or reference number</span><input value={draft.policyNumber} onChange={(e) => setDraft({ ...draft, policyNumber: e.target.value })} /></label>
                  <div className="ad-form-pair">
                    <label className="ad-form-row"><span>Starts</span><input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
                    <label className="ad-form-row"><span>Expires</span><input type="date" value={draft.expiryDate} onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })} /></label>
                  </div>
                  <label className="ad-form-row"><span>Notes</span><input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
                  <div className="ad-panel-actions">
                    <button type="submit" className="ad-button ad-button--primary">Save</button>
                    <button type="button" className="ad-button" onClick={() => setAdding(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <section className="ad-panel">
                  <span className="ad-label">Keep papers current</span>
                  <p style={{ margin: 0, fontSize: 14 }}>Add insurance, FASTag, PUC or warranty details so the studio can remind the owner before they run out.</p>
                  <div className="ad-panel-actions"><button type="button" className="ad-button ad-button--primary" onClick={() => setAdding(true)}>Add a paper</button></div>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
      {!p.vehicle && !p.error && (
        <div className="ad-panel ad-empty" style={{ marginTop: "var(--ad-space-inset)" }}>
          <p className="ad-title">Type a number plate to start</p>
          <p>Spaces don&apos;t matter. You&apos;ll see the car, its owner&apos;s papers and what&apos;s about to expire.</p>
        </div>
      )}
    </div>
  );
}
