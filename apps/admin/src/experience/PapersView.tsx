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
  onReview: (paper: PaperVerification, decision: "VERIFIED" | "REJECTED", reason: string) => void;
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
    <div className="ad-page">
      <PageHead
        eyebrow="Office"
        title="Papers"
        kpis={[
          { value: p.papers.filter((x) => x.status === "PENDING").length, label: "Awaiting review", tone: "accent" },
          { value: p.papers.filter((x) => x.expiresOn !== null && x.expiresOn < today).length, label: "Expired" },
        ]}
      />
      {p.error && <p className="ad-status-msg ad-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ad-status-msg">{p.message}</p>}

      <div className="ad-detail">
        <div className="ad-detail-main">
          <section className="ad-panel">
            <Segmented<StatusFilter>
              value={p.filter}
              options={[
                { value: "PENDING", label: "Pending" },
                { value: "VERIFIED", label: "Verified" },
                { value: "REJECTED", label: "Rejected" },
              ]}
              onChange={p.onFilter}
            />
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ad-skel ad-skel--row" />)
            ) : p.papers.length === 0 ? (
              <p className="ad-note">Nothing {p.filter.toLowerCase()} right now.</p>
            ) : (
              <ul className="ad-list">
                {p.papers.map((paper) => {
                  const expired = paper.expiresOn !== null && paper.expiresOn < today;
                  return (
                    <li key={paper.id} className="ad-list-row">
                      <span className="ad-slot-main">
                        <span className="ad-person-name">
                          {KIND_NAME[paper.kind]} · {paper.reference}
                        </span>
                        <span className="ad-sub">
                          {vehicleName(p.vehiclesById.get(paper.vehicleId))} · expires {formatDate(paper.expiresOn)}
                          {paper.rejectionReason ? ` · rejected: ${paper.rejectionReason}` : ""}
                        </span>
                      </span>
                      {expired && <span className="ad-expiry ad-expiry--danger">expired</span>}
                      {paper.status === "PENDING" && (
                        <span className="ad-row-actions">
                          <button type="button" className="ad-button ad-button--primary" disabled={p.busy} onClick={() => p.onReview(paper, "VERIFIED", "")}>
                            Verify
                          </button>
                          {rejectId === paper.id ? (
                            <>
                              <input
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Reason for rejection"
                                aria-label="Rejection reason"
                              />
                              <button
                                type="button"
                                className="ad-button ad-button--danger"
                                disabled={p.busy || !rejectReason.trim()}
                                onClick={() => { p.onReview(paper, "REJECTED", rejectReason.trim()); setRejectId(null); setRejectReason(""); }}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <button type="button" className="ad-button" onClick={() => setRejectId(paper.id)}>Reject</button>
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

        <div className="ad-detail-side">
          <section className="ad-panel">
            <span className="ad-label">Register a document</span>
            <div className="ad-form-section">
              <div className="ad-form-pair">
                <input value={plate} onChange={(e) => { setPlate(e.target.value.toUpperCase()); setFound(null); }} placeholder="Plate · GJ01AB1234" aria-label="Vehicle plate" disabled={p.busy} />
                <button
                  type="button"
                  className="ad-button"
                  disabled={p.busy || plate.trim().length < 6}
                  onClick={() => {
                    setFound("searching");
                    void p.onResolvePlate(plate.trim()).then((v) => setFound(v ?? "missing"));
                  }}
                >
                  Find
                </button>
              </div>
              {found === "searching" && <p className="ad-note">Searching…</p>}
              {found === "missing" && <p className="ad-status-msg ad-status-msg--warn">No vehicle with that plate.</p>}
              {found && found !== "searching" && found !== "missing" && (
                <p className="ad-status-msg">{vehicleName(found)}</p>
              )}
              <div className="ad-form-pair">
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
                className="ad-button ad-button--primary"
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
