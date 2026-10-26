"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "../../../lib/auth-context";
import { StatusBadge } from "../../../components/StatusBadge";
import { ADMIN_APPROVAL_REVIEW_ENABLED } from "../../../lib/backend-features";
import { listenToOfficeRequests, respondToOfficeRequest } from "../../../lib/office-request-service";
import { DECISION_NOTE, STATUS_WORDS, targetLink, type OfficeRequestRow } from "../../../lib/office-request-rules";

type Tab = "pending" | "decided" | "all";
const TABS: { id: Tab; label: string }[] = [{ id: "pending", label: "Waiting" }, { id: "decided", label: "Decided" }, { id: "all", label: "All" }];
const TARGET_WORDS = { job: "Job", booking: "Booking", pickup_request: "Pickup", none: "General" } as const;

export default function OfficeRequestsPage() {
  if (!ADMIN_APPROVAL_REVIEW_ENABLED) {
    return (
      <div className="ax-page">
        <header className="ax-page-head"><div><p className="ax-label">Studio service</p><h1>Staff requests</h1></div></header>
        <div className="ax-empty"><p className="ax-title">Not available yet</p><p>Staff requests for approval will show here once this feature is switched on.</p></div>
      </div>
    );
  }
  return <Review />;
}

function Review() {
  const { claims } = useAdminAuth();
  const [rows, setRows] = useState<OfficeRequestRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!claims) return;
    setLoadError(null);
    return listenToOfficeRequests(claims.tenantId, setRows, () => { setLoadError("Couldn't load staff requests."); setRows([]); });
  }, [claims]);

  const counts = useMemo(() => {
    const c = { pending: 0, decided: 0, all: 0 };
    for (const r of rows ?? []) { c.all += 1; if (r.status === "pending") c.pending += 1; else c.decided += 1; }
    return c;
  }, [rows]);
  const shown = (rows ?? []).filter((r) => tab === "all" || (tab === "pending" ? r.status === "pending" : r.status !== "pending"));

  async function decide(r: OfficeRequestRow, decision: "approved" | "rejected") {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(r.id); setError(null);
    try { await respondToOfficeRequest(r.id, decision, notes[r.id] ?? ""); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : "Couldn't record that decision."); }
    finally { busyRef.current = false; setBusy(null); }
  }

  return (
    <div className="ax-page ax-pu">
      <header className="ax-page-head">
        <div><p className="ax-label">Studio service</p><h1>Staff requests</h1></div>
        <div className="ax-kpis" aria-label="At a glance">
          <div><span className="ax-kpi-v ax-kpi-v--accent">{counts.pending}</span><span className="ax-label">Waiting</span></div>
          <div><span className="ax-kpi-v">{counts.decided}</span><span className="ax-label">Decided</span></div>
        </div>
      </header>
      <div className="ax-toolbar">
        <div className="ax-seg" role="group" aria-label="Show">
          {TABS.map((t) => <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label} {counts[t.id]}</button>)}
        </div>
        <p className="ax-pu-policy">{DECISION_NOTE}</p>
      </div>
      {loadError ? <p role="alert" className="ax-pu-error">{loadError}</p> : null}
      {error ? <p role="alert" className="ax-pu-error">{error}</p> : null}
      {rows === null ? (
        <div className="ax-panel" role="status">Loading requests...</div>
      ) : shown.length === 0 ? (
        <div className="ax-empty"><p className="ax-title">{tab === "pending" ? "Nothing waiting" : "No requests here"}</p><p>{tab === "pending" ? "When staff ask the office to decide something, it shows up here." : "Try another tab."}</p></div>
      ) : (
        <div className="ax-pu-grid">
          {shown.map((r) => {
            const link = targetLink(r);
            return (
              <section key={r.id} className="ax-panel ax-pu-card">
                <div className="ax-pu-top"><h2>{TARGET_WORDS[r.targetType] ?? "Request"}</h2><StatusBadge label={STATUS_WORDS[r.status] ?? r.status} /></div>
                <p className="ax-pu-addr">{r.reason}</p>
                {typeof r.amountPaise === "number" ? <p className="ax-pu-hint">{`Amount mentioned: Rs ${(r.amountPaise / 100).toLocaleString("en-IN")} (for reference only)`}</p> : null}
                {r.status === "pending" ? (
                  <textarea rows={1} aria-label="Note for the staff member" placeholder="Note for the staff member (optional)" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} maxLength={300} className="ax-pu-note" />
                ) : r.responseNote ? <p className="ax-pu-staffnote">{r.responseNote}</p> : null}
                <div className="ax-pu-foot">
                  {link ? <Link href={link.href} className="ax-linkbtn">{link.label}</Link> : <span />}
                  {r.status === "pending" ? (
                    <div className="ax-pu-actions">
                      <button type="button" className="ax-button" disabled={busy !== null} onClick={() => void decide(r, "rejected")}>Decline</button>
                      <button type="button" className="ax-button" disabled={busy !== null} onClick={() => void decide(r, "approved")}>Approve</button>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
