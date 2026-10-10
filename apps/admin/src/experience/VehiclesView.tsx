"use client";

// Vehicles: find a car by plate, see its papers (insurance, FASTag, PUC, RC,
// warranty) with how long each has left, and add or verify records.
import { useState } from "react";
import type { Vehicle, Protection, ProtectionKind, ProtectionStatus } from "@autodeck/core";
import { PageHead } from "./Office";
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
  if (!date) return <span className="ax-sub">No expiry on file</span>;
  const d = daysLeft(date, today);
  const tone = d < 0 ? "danger" : d <= 30 ? "warning" : "ok";
  const text = d < 0 ? `Expired ${-d} day${d === -1 ? "" : "s"} ago` : d === 0 ? "Expires today" : `${d} day${d === 1 ? "" : "s"} left`;
  return <span className={`ax-expiry ax-expiry--${tone}`}>{text} · {formatDate(date)}</span>;
}

export function VehiclesView(p: {
  today: string;
  searching: boolean;
  vehicle: Vehicle | null;
  protections: Protection[];
  error: string | null;
  message: string | null;
  fleet: Vehicle[];
  ownerNames: Record<string, string>;
  onPick: (v: Vehicle) => void;
  onOpenOwner: (ownerId: string) => void;
  onSearch: (plate: string) => void;
  onAdd: (draft: ProtectionDraft) => void;
  onStatus: (prot: Protection, status: ProtectionStatus) => void;
}) {
  const [plate, setPlate] = useState("");
  const [draft, setDraft] = useState<ProtectionDraft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const expiring = p.protections.filter((x) => x.expiryDate && daysLeft(x.expiryDate, p.today) <= 30).length;

  return (
    <div className="ax-page">
      <PageHead eyebrow="Office" title="Vehicles" />
      <form className="ax-panel ax-plate-search" onSubmit={(e) => { e.preventDefault(); p.onSearch(plate); }}>
        <span className="ax-label">Find a car</span>
        <div className="ax-plate-row">
          <input className="ax-plate-input" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="GJ 01 AB 1234" aria-label="Number plate" />
          <button type="submit" className="ax-button ax-button--primary" disabled={p.searching || plate.trim().length < 4}>{p.searching ? "Looking" : "Find"}</button>
        </div>
      </form>
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      {p.vehicle && (
        <>
          <div className="ax-hero" style={{ marginTop: "var(--ad-space-inset)" }}>
            <div>
              <p className="ax-label">{[p.vehicle.year, p.vehicle.make].filter(Boolean).join(" ")}</p>
              <h1>{p.vehicle.registrationNumber}</h1>
              <p className="ax-hero-sub">{[p.vehicle.make, p.vehicle.model, p.vehicle.color].filter(Boolean).join(" ")}{p.vehicle.ownerId ? <> · Owner: <button type="button" className="ax-linkbtn" onClick={() => p.onOpenOwner(p.vehicle!.ownerId)}>{p.ownerNames[p.vehicle.ownerId] ?? "Open customer"}</button></> : null}</p>
            </div>
            <div className="ax-kpis">
              <div><span className="ax-kpi-v">{p.protections.length}</span><span className="ax-label">Papers on file</span></div>
              <div><span className={`ax-kpi-v${expiring ? " ax-kpi-v--accent" : ""}`}>{expiring}</span><span className="ax-label">Due within 30 days</span></div>
            </div>
          </div>

          <div className="ax-detail">
            <div className="ax-detail-main">
              <section className="ax-panel">
                <span className="ax-label">Papers</span>
                {p.protections.length === 0 ? (
                  <p className="ax-note">Nothing on file for this car yet.</p>
                ) : (
                  <ul className="ax-papers">
                    {p.protections.map((x) => (
                      <li key={x.id} className="ax-paper">
                        <div className="ax-paper-main">
                          <span className="ax-person-name">{KIND_LABEL[x.kind]}</span>
                          <span className="ax-sub">{[x.provider, x.policyNumber].filter(Boolean).join(" · ") || "No provider details"}</span>
                          <Expiry date={x.expiryDate} today={p.today} />
                        </div>
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
            <aside className="ax-detail-side">
              {adding ? (
                <form className="ax-panel" onSubmit={(e) => { e.preventDefault(); p.onAdd(draft); setDraft(EMPTY); setAdding(false); }}>
                  <span className="ax-label">Add a paper</span>
                  <label className="ax-form-row"><span>Type</span>
                    <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ProtectionKind })}>
                      {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                    </select>
                  </label>
                  <label className="ax-form-row"><span>Provider</span><input value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} placeholder="e.g. ICICI Lombard" /></label>
                  <label className="ax-form-row"><span>Policy or reference number</span><input value={draft.policyNumber} onChange={(e) => setDraft({ ...draft, policyNumber: e.target.value })} /></label>
                  <div className="ax-form-pair">
                    <label className="ax-form-row"><span>Starts</span><input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
                    <label className="ax-form-row"><span>Expires</span><input type="date" value={draft.expiryDate} onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })} /></label>
                  </div>
                  <label className="ax-form-row"><span>Notes</span><input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
                  <div className="ax-panel-actions">
                    <button type="submit" className="ax-button ax-button--primary">Save</button>
                    <button type="button" className="ax-button" onClick={() => setAdding(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <section className="ax-panel">
                  <span className="ax-label">Keep papers current</span>
                  <p style={{ margin: 0, fontSize: 14 }}>Add insurance, FASTag, PUC or warranty details so the studio can remind the owner before they run out.</p>
                  <div className="ax-panel-actions"><button type="button" className="ax-button ax-button--primary" onClick={() => setAdding(true)}>Add a paper</button></div>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
      <section className="ax-panel" style={{ marginTop: "var(--ad-space-inset)" }}>
        <span className="ax-label">All cars on file ({p.fleet.length})</span>
        {p.fleet.length === 0 ? <p className="ax-note">No cars yet.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Plate</th><th>Car</th><th>Colour</th><th>Owner</th><th>Added</th></tr></thead>
              <tbody>
                {[...p.fleet].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).map((v) => (
                  <tr key={v.id} className="row-link" tabIndex={0} role="link" onClick={() => p.onPick(v)} onKeyDown={(e) => { if (e.key === "Enter") p.onPick(v); }}>
                    <td className="ax-data">{v.registrationNumber}</td>
                    <td>{[v.year, v.make, v.model].filter(Boolean).join(" ")}</td>
                    <td>{v.color || "-"}</td>
                    <td>{p.ownerNames[v.ownerId] ?? "..."}</td>
                    <td>{v.createdAt ? formatDate(v.createdAt) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {!p.vehicle && !p.error && (
        <div className="ax-panel ax-empty" style={{ marginTop: "var(--ad-space-inset)" }}>
          <p className="ax-title">Type a number plate to start</p>
          <p>Spaces don&apos;t matter. You&apos;ll see the car, its owner&apos;s papers and what&apos;s about to expire.</p>
        </div>
      )}
    </div>
  );
}
