"use client";

// Vehicles: find a car by plate, see its papers (insurance, FASTag, PUC, RC,
// warranty) with how long each has left, and add or verify records.
import { useRef, useState } from "react";
import type { Vehicle, Protection, ProtectionKind, ProtectionStatus, PaperVerification, PaperKind, PaperStatus } from "@autodeck/core";
import { PageHead } from "./Office";
import { formatDate } from "../lib/format";

export const KIND_LABEL: Record<ProtectionKind, string> = {
  insurance: "Insurance",
  fasttag: "FASTag",
  puc: "PUC certificate",
  rc: "Registration (RC)",
  extended_warranty: "Extended warranty",
  ppf: "Paint protection film (PPF)",
  ceramic: "Ceramic coating",
  other: "Other",
};
const KINDS = Object.keys(KIND_LABEL) as ProtectionKind[];

const DOC_KIND_LABEL: Record<PaperKind, string> = {
  RC: "Registration (RC)",
  INSURANCE: "Insurance",
  PUC: "PUC certificate",
  FASTAG: "FASTag",
  OTHER: "Other",
};

const DOC_STATUS_LABEL: Record<PaperStatus, string> = {
  PENDING: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

function docTitle(d: PaperVerification): string {
  return d.kind === "OTHER" && d.title ? d.title : DOC_KIND_LABEL[d.kind];
}

export interface ProtectionDraft {
  kind: ProtectionKind;
  provider: string;
  policyNumber: string;
  startDate: string;
  expiryDate: string;
  notes: string;
}
const EMPTY: ProtectionDraft = { kind: "insurance", provider: "", policyNumber: "", startDate: "", expiryDate: "", notes: "" };

// An admin correction edits the viewed record's declarative fields and, for
// cosmetic records only, its coverage scope. `coverage` is undefined when the
// admin explicitly chose to keep the recorded scope - the choice itself is
// never defaulted for them.
export type CoverageLevel = NonNullable<Protection["coverage"]>;
// A blank field is an explicit CLEAR (null), never a silent keep; an omitted
// change is only ever the recorded value itself (coverage "keep", or a field
// the admin did not blank).
export interface CorrectionDraft {
  provider: string | null;
  policyNumber: string | null;
  startDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  warrantyYears: number | null;
  coverage: CoverageLevel | undefined;
}
export const COVERAGE_LABEL: Record<CoverageLevel, string> = {
  full_body: "Full body",
  full_front: "Full front",
  high_impact: "High-impact kit",
};
const CORRECTABLE_KINDS: ProtectionKind[] = ["ppf", "ceramic"];
export function lifecycleLabel(lifecycle: Protection["lifecycle"]): string {
  // Malformed legacy values render as neutral history, never a guessed
  // "Removed".
  if (lifecycle === "superseded") return "Superseded";
  if (lifecycle === "removed") return "Removed";
  return "History";
}

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
  documents: PaperVerification[];
  error: string | null;
  message: string | null;
  fleet: Vehicle[];
  ownerNames: Record<string, string>;
  onPick: (v: Vehicle) => void;
  onOpenOwner: (ownerId: string) => void;
  onSearch: (plate: string) => void;
  onAdd: (draft: ProtectionDraft) => void;
  // Authority fingerprint of the viewing session (uid|tenant|studio|role|
  // verifying) and the page's selection generation. Any change disarms an
  // open correction permanently.
  authorityKey: string;
  selectionKey: string;
  // Callbacks hand back the fingerprint captured at arm/event time so the
  // parent can refuse retained invocations; they never read current state.
  onStatus: (vehicle: Vehicle, prot: Protection, status: ProtectionStatus, capturedFp: string) => void;
  onCorrect: (vehicle: Vehicle, prot: Protection, draft: CorrectionDraft, capturedFp: string) => void;
}) {
  const [plate, setPlate] = useState("");
  const [draft, setDraft] = useState<ProtectionDraft>(EMPTY);
  const [adding, setAdding] = useState(false);
  // Frozen correction target: the FULL identity (viewed vehicle + record) is
  // captured at open with a fresh generation. Navigating to another car
  // disarms the generation PERMANENTLY - an A->B->A round trip never revives
  // the form - so a correction can never land on a different car's record,
  // and a later snapshot of the same record never retargets it.
  const [target, setTarget] = useState<{ gen: number; vehicle: Vehicle; prot: Protection } | null>(null);
  const genRef = useRef(0);
  // The CURRENTLY armed correction: immutable arm id + full authority
  // fingerprint. A retained old submit compares against THIS ref, so a
  // cancel, navigation, authority change, or fresh re-arm makes it a no-op.
  const armRef = useRef<{ gen: number; fp: string } | null>(null);
  const [corr, setCorr] = useState({ provider: "", policyNumber: "", startDate: "", expiryDate: "", notes: "", warrantyYears: "" });
  // Explicit scope election: null until the admin picks, including "keep".
  const [scopeChoice, setScopeChoice] = useState<"keep" | CoverageLevel | null>(null);
  const [corrError, setCorrError] = useState<string | null>(null);

  const fpOf = (v: Vehicle | null) => (v ? `${v.id}|${v.tenantId}|${v.ownerId}|${p.authorityKey}|${p.selectionKey}` : "");

  function openCorrection(x: Protection) {
    // Synchronous read-scope guard: the row must belong to the car actually
    // being viewed (a stale list from a previous car can never arm).
    if (!p.vehicle || x.vehicleId !== p.vehicle.id || x.tenantId !== p.vehicle.tenantId) return;
    setAdding(false);
    setCorrError(null);
    genRef.current += 1;
    armRef.current = { gen: genRef.current, fp: fpOf(p.vehicle) };
    setTarget({ gen: genRef.current, vehicle: p.vehicle, prot: x });
    setCorr({
      provider: x.provider ?? "",
      policyNumber: x.policyNumber ?? "",
      startDate: x.startDate ?? "",
      expiryDate: x.expiryDate ?? "",
      notes: x.notes ?? "",
      warrantyYears: x.warrantyYears != null ? String(x.warrantyYears) : "",
    });
    setScopeChoice(null);
  }

  // Synchronous render-time disarm (no effect window): the moment the viewed
  // car, its owner/tenant, or the session authority differs from the armed
  // fingerprint, the arm is dead - and an A->B->A round trip never revives
  // it, because only a fresh openCorrection mints a new generation.
  if (armRef.current && fpOf(p.vehicle ?? null) !== armRef.current.fp) armRef.current = null;
  const live = target && armRef.current && armRef.current.gen === target.gen ? target : null;

  function submitCorrection(e: { preventDefault: () => void }) {
    e.preventDefault();
    // Retained-submit guard: only the CURRENTLY armed generation may submit.
    if (!live || !armRef.current || armRef.current.gen !== live.gen) return;
    const cosmetic = CORRECTABLE_KINDS.includes(live.prot.kind);
    // The handler itself enforces the election - a disabled button is not a
    // guard against Enter/direct submit.
    if (cosmetic && scopeChoice === null) {
      setCorrError("Choose a coverage scope first - 'Keep as recorded' keeps the current one.");
      return;
    }
    let warrantyYears: number | null = null;
    if (corr.warrantyYears.trim() !== "") {
      const n = Number(corr.warrantyYears);
      if (!Number.isInteger(n) || n < 1 || n > 50) {
        setCorrError("Warranty years must be a whole number between 1 and 50.");
        return;
      }
      warrantyYears = n;
    }
    const clear = (v: string) => (v.trim() === "" ? null : v.trim());
    const capturedFp = armRef.current.fp;
    armRef.current = null;
    p.onCorrect(live.vehicle, live.prot, {
      provider: clear(corr.provider),
      policyNumber: clear(corr.policyNumber),
      startDate: clear(corr.startDate),
      expiryDate: clear(corr.expiryDate),
      notes: clear(corr.notes),
      warrantyYears,
      coverage: scopeChoice === null || scopeChoice === "keep" ? undefined : scopeChoice,
    }, capturedFp);
    setTarget(null);
  }
  const expiring = p.protections.filter((x) => x.expiryDate && daysLeft(x.expiryDate, p.today) <= 30).length;

  return (
    <div className="ax-page">
      <PageHead eyebrow="Office" title="Cars" />
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
              <div><span className="ax-kpi-v">{p.protections.length}</span><span className="ax-label">Studio papers</span></div>
              <div><span className="ax-kpi-v">{p.documents.length}</span><span className="ax-label">Customer documents</span></div>
              <div><span className={`ax-kpi-v${expiring ? " ax-kpi-v--accent" : ""}`}>{expiring}</span><span className="ax-label">Studio papers due in 30 days</span></div>
            </div>
          </div>

          <div className="ax-detail">
            <div className="ax-detail-main">
              <section className="ax-panel">
                <span className="ax-label">Papers</span>
                {p.protections.length === 0 && p.documents.length === 0 ? (
                  <p className="ax-note">Nothing on file for this car yet.</p>
                ) : (
                  <>
                    {p.protections.length > 0 && (
                      <ul className="ax-papers">
                        {p.protections.map((x) => (
                          <li key={x.id} className="ax-paper">
                            <div className="ax-paper-main">
                              <span className="ax-person-name">{KIND_LABEL[x.kind]}</span>
                              <span className="ax-sub">{[x.provider, x.policyNumber].filter(Boolean).join(" · ") || "No provider details"}</span>
                              <Expiry date={x.expiryDate} today={p.today} />
                            </div>
                            {(x.lifecycle ?? "current") === "current" ? (
                              <span className="ax-row-actions">
                                <select value={x.status} onChange={(e) => { if (p.vehicle && x.vehicleId === p.vehicle.id && x.tenantId === p.vehicle.tenantId) p.onStatus(p.vehicle, x, e.target.value as ProtectionStatus, fpOf(p.vehicle)); }} aria-label={`Status of ${KIND_LABEL[x.kind]}`}>
                                  <option value="unverified">Not checked</option>
                                  <option value="verified">Checked</option>
                                  <option value="expired">Expired</option>
                                </select>
                                <button type="button" className="ax-linkbtn" onClick={() => openCorrection(x)}>Correct</button>
                              </span>
                            ) : (
                              // History is immutable evidence: no correction
                              // affordance on a superseded or removed record.
                              <span className="ax-sub">{lifecycleLabel(x.lifecycle)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {p.documents.length > 0 && (
                      <>
                        <span className="ax-label" style={{ marginTop: 12 }}>Customer documents</span>
                        <ul className="ax-papers">
                          {p.documents.map((d) => (
                            <li key={d.id} className="ax-paper">
                              <div className="ax-paper-main">
                                <span className="ax-person-name">{docTitle(d)}</span>
                                <span className="ax-sub">{[d.reference, DOC_STATUS_LABEL[d.status]].filter(Boolean).join(" · ")}</span>
                                <Expiry date={d.expiresOn} today={p.today} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
            <aside className="ax-detail-side">
              {live ? (
                <form className="ax-panel" onSubmit={submitCorrection}>
                  <span className="ax-label">Correct {KIND_LABEL[live.prot.kind].toLowerCase()} record</span>
                  <p className="ax-note" style={{ margin: 0 }}>
                    Editing the record exactly as shown on this page{live.prot.updatedAt ? ` (updated ${formatDate(live.prot.updatedAt)})` : ""}. If it changed since, saving fails and you review the fresh record. Blank a field to remove it from the record.
                  </p>
                  <label className="ax-form-row"><span>Provider</span><input value={corr.provider} onChange={(e) => setCorr({ ...corr, provider: e.target.value })} aria-label="Correct provider" /></label>
                  <label className="ax-form-row"><span>Policy or reference number</span><input value={corr.policyNumber} onChange={(e) => setCorr({ ...corr, policyNumber: e.target.value })} aria-label="Correct policy number" /></label>
                  <div className="ax-form-pair">
                    <label className="ax-form-row"><span>Starts</span><input type="date" value={corr.startDate} onChange={(e) => setCorr({ ...corr, startDate: e.target.value })} aria-label="Correct start date" /></label>
                    <label className="ax-form-row"><span>Expires</span><input type="date" value={corr.expiryDate} onChange={(e) => setCorr({ ...corr, expiryDate: e.target.value })} aria-label="Correct expiry date" /></label>
                  </div>
                  <label className="ax-form-row"><span>Warranty (years)</span><input inputMode="numeric" value={corr.warrantyYears} onChange={(e) => setCorr({ ...corr, warrantyYears: e.target.value })} aria-label="Correct warranty years" placeholder="e.g. 5" /></label>
                  <label className="ax-form-row"><span>Notes</span><input value={corr.notes} onChange={(e) => setCorr({ ...corr, notes: e.target.value })} aria-label="Correct notes" /></label>
                  {CORRECTABLE_KINDS.includes(live.prot.kind) && (
                    <fieldset className="ax-form-row" style={{ border: 0, padding: 0, margin: 0 }}>
                      <span>Coverage scope</span>
                      <label className="ax-radio"><input type="radio" name="corr-scope" checked={scopeChoice === "keep"} onChange={() => setScopeChoice("keep")} />
                        Keep as recorded{live.prot.coverage ? ` (${COVERAGE_LABEL[live.prot.coverage]})` : " (not on file)"}</label>
                      {(Object.keys(COVERAGE_LABEL) as CoverageLevel[]).map((c) => (
                        <label className="ax-radio" key={c}><input type="radio" name="corr-scope" checked={scopeChoice === c} onChange={() => setScopeChoice(c)} />
                          {COVERAGE_LABEL[c]}</label>
                      ))}
                      <span className="ax-sub">Choose one - nothing is pre-selected.</span>
                    </fieldset>
                  )}
                  {corrError && <p className="ax-status-msg ax-status-msg--warn" role="alert">{corrError}</p>}
                  <div className="ax-panel-actions">
                    <button type="submit" className="ax-button" disabled={CORRECTABLE_KINDS.includes(live.prot.kind) && scopeChoice === null}>Save correction</button>
                    <button type="button" className="ax-button" onClick={() => { armRef.current = null; setTarget(null); }}>Cancel</button>
                  </div>
                </form>
              ) : adding ? (
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
                  <p style={{ margin: 0, fontSize: 14 }}>Add insurance, FASTag, PUC or warranty so the studio can remind the owner before expiry.</p>
                  <div className="ax-panel-actions"><button type="button" className="ax-button ax-button--primary" onClick={() => { setTarget(null); setAdding(true); }}>Add a paper</button></div>
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
