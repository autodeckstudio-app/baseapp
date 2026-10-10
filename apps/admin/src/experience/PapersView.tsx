"use client";

// Papers: customer vehicle documents (RC, insurance, PUC, FASTag) awaiting
// office verification. Staff register the document from the physical copy;
// verify or reject with a reason the customer can be told.
import { useState } from "react";
import type { PaperKind, PaperVerification, Vehicle } from "@autodeck/core";
import { PageHead, Segmented } from "./Office";
import { formatDate } from "../lib/format";

const KIND_NAME: Record<PaperKind, string> = {
  RC: "RC",
  INSURANCE: "Insurance",
  PUC: "PUC",
  FASTAG: "FASTag",
  OTHER: "Other",
};

type StatusFilter = "PENDING" | "VERIFIED" | "REJECTED";

export function PapersView(p: {
  filter: StatusFilter;
  papers: PaperVerification[];
  vehiclesById: Map<string, Vehicle>;
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  onFilter: (f: StatusFilter) => void;
  onResolvePlate: (plate: string) => Promise<Vehicle | null>;
  onSubmit: (input: { vehicleId: string; kind: PaperKind; reference: string; expiresOn: string; notes: string }) => void;
  onReview: (paper: PaperVerification, decision: "VERIFIED" | "REJECTED", reason: string) => Promise<boolean>;
}) {
  const [plate, setPlate] = useState("");
  const [found, setFound] = useState<Vehicle | null | "searching" | "missing">(null);
  const [kind, setKind] = useState<PaperKind>("INSURANCE");
  const [reference, setReference] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const vehicleName = (v: Vehicle | undefined) => (v ? `${v.make} ${v.model} · ${v.registrationNumber}` : "Unknown vehicle");

  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Office"
        title="Documents"
        kpis={[
          { value: p.papers.filter((x) => x.status === "PENDING").length, label: "Needs review", tone: "accent" },
          { value: p.papers.filter((x) => x.expiresOn !== null && x.expiresOn < today).length, label: "Expired" },
        ]}
      />
      <p className="ax-note">Readable documents are checked automatically against the vehicle plate and expiry. Anything that is not clearly valid (unreadable, wrong plate, expired) waits here with the reason, for your decision.</p>
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            <Segmented<StatusFilter>
              value={p.filter}
              options={[
                { value: "PENDING", label: "Needs review" },
                { value: "VERIFIED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
              ]}
              onChange={p.onFilter}
            />
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ax-skel ax-skel--row" />)
            ) : p.papers.length === 0 ? (
              <p className="ax-note">Nothing {p.filter.toLowerCase()} right now.</p>
            ) : (
              <ul className="ax-list">
                {p.papers.map((paper) => {
                  const expired = paper.expiresOn !== null && paper.expiresOn < today;
                  return (
                    <li key={paper.id} className="ax-list-row ax-paper-row">
                      <span className="ax-slot-main" style={{ whiteSpace: "normal", overflow: "visible" }}>
                        <span className="ax-person-name">
                          {KIND_NAME[paper.kind]} · {paper.reference}
                        </span>
                        <span className="ax-sub">
                          {vehicleName(p.vehiclesById.get(paper.vehicleId))} · expires {formatDate(paper.expiresOn)}
                          {paper.rejectionReason ? ` · rejected: ${paper.rejectionReason}` : ""}
                        </span>
                        <span className="ax-sub" style={{ whiteSpace: "normal", overflow: "visible" }}>{paper.verificationMode === "automatic" ? paper.status === "VERIFIED" ? "Auto-approved" : "Auto-rejected" : paper.verificationMode === "manual" ? "Reviewed by staff" : "Manual review needed"}{paper.verificationReason ? `: ${paper.verificationReason.replace(/^Needs review:\s*/i, "")}` : ": Original document needs a closer look."}</span>
                        {paper.evidenceUrl && <a href={paper.evidenceUrl} target="_blank" rel="noreferrer">Open original document</a>}
                      </span>
                      {expired && <span className="ax-expiry ax-expiry--danger">expired</span>}
                      {paper.status === "PENDING" && (
                        <span className="ax-row-actions" style={{ flexWrap: "wrap", width: rejectId === paper.id ? "100%" : undefined }}>
                          <button type="button" className="ax-button ax-button--primary" disabled={p.busy} onClick={() => void p.onReview(paper, "VERIFIED", "")}>
                            Verify
                          </button>
                          {rejectId === paper.id ? (
                            <>
                              <input
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                style={{ minWidth: 220, flex: 1 }}
                                maxLength={300}
                                placeholder="Reason for rejection"
                                aria-label="Rejection reason"
                              />
                              <button
                                type="button"
                                className="ax-button ax-button--danger"
                                disabled={p.busy || !rejectReason.trim()}
                                onClick={() => { void p.onReview(paper, "REJECTED", rejectReason.trim()).then((ok) => { if (ok) { setRejectId(null); setRejectReason(""); } }); }}
                              >
                                Confirm rejection
                              </button>
                              <button type="button" className="ax-button" disabled={p.busy} onClick={() => { setRejectId(null); setRejectReason(""); }}>Cancel</button>
                            </>
                          ) : (
                            <button type="button" className="ax-button" onClick={() => setRejectId(paper.id)}>Reject</button>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="ax-detail-side">
          <section className="ax-panel">
            <span className="ax-label">Register a document</span>
            <div className="ax-form-section">
              <div className="ax-form-pair">
                <input value={plate} onChange={(e) => { setPlate(e.target.value.toUpperCase()); setFound(null); }} placeholder="Plate · GJ01AB1234" aria-label="Vehicle plate" disabled={p.busy} />
                <button
                  type="button"
                  className="ax-button"
                  disabled={p.busy || plate.trim().length < 6}
                  onClick={() => {
                    setFound("searching");
                    void p.onResolvePlate(plate.trim()).then((v) => setFound(v ?? "missing"));
                  }}
                >
                  Find
                </button>
              </div>
              {found === "searching" && <p className="ax-note">Searching…</p>}
              {found === "missing" && <p className="ax-status-msg ax-status-msg--warn">No vehicle with that plate.</p>}
              {found && found !== "searching" && found !== "missing" && (
                <p className="ax-status-msg">{vehicleName(found)}</p>
              )}
              <div className="ax-form-pair">
                <select value={kind} onChange={(e) => setKind(e.target.value as PaperKind)} aria-label="Document kind" disabled={p.busy}>
                  {(Object.keys(KIND_NAME) as PaperKind[]).map((k) => (
                    <option key={k} value={k}>{KIND_NAME[k]}</option>
                  ))}
                </select>
                <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} aria-label="Expiry date" disabled={p.busy} />
              </div>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Document / policy number" aria-label="Reference number" disabled={p.busy} />
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)" aria-label="Note" disabled={p.busy} />
              <button
                type="button"
                className="ax-button ax-button--primary"
                disabled={p.busy || !found || found === "searching" || found === "missing" || !reference.trim()}
                onClick={() => {
                  if (!found || found === "searching" || found === "missing") return;
                  p.onSubmit({ vehicleId: found.id, kind, reference: reference.trim(), expiresOn, notes: notes.trim() });
                  setReference(""); setExpiresOn(""); setNotes(""); setFound(null); setPlate("");
                }}
              >
                Register for verification
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
