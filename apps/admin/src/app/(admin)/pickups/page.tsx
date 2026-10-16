"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listenToPickupRequests, setPickupStatus, type PickupRequestRow } from "../../../lib/pickup-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { StatusBadge } from "../../../components/StatusBadge";

type Status = PickupRequestRow["status"];
type Tab = Status | "ALL";

const KIND = { pickup: "Pick up", drop: "Drop back", both: "Pick up and drop back" } as const;
const STATUS_LABEL: Record<Status, string> = { REQUESTED: "Waiting", CONFIRMED: "Approved", DONE: "Done", DECLINED: "Declined" };
const TABS: { id: Tab; label: string }[] = [
  { id: "REQUESTED", label: "Waiting" },
  { id: "CONFIRMED", label: "Approved" },
  { id: "DONE", label: "Done" },
  { id: "DECLINED", label: "Declined" },
  { id: "ALL", label: "All" },
];

function formatAgreed(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

export default function PickupsPage() {
  const { claims } = useAdminAuth();
  const [rows, setRows] = useState<PickupRequestRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("REQUESTED");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [agreedPickup, setAgreedPickup] = useState<Record<string, string>>({});
  const [agreedDrop, setAgreedDrop] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!claims) return;
    setLoadError(null);
    return listenToPickupRequests(claims.tenantId, setRows, () => { setLoadError("Couldn't load pickup requests."); setRows([]); });
  }, [claims]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { REQUESTED: 0, CONFIRMED: 0, DONE: 0, DECLINED: 0, ALL: 0 };
    for (const r of rows ?? []) { c[r.status] += 1; c.ALL += 1; }
    return c;
  }, [rows]);
  const shown = (rows ?? []).filter((r) => tab === "ALL" || r.status === tab);

  async function act(r: PickupRequestRow, status: Status) {
    if (busy) return;
    setBusy(r.id); setError(null);
    try {
      const agreed: { agreedPickupAt?: string; agreedDropAt?: string } = {};
      if (status === "CONFIRMED") {
        // Timing is agreed with the customer by phone call; it must be entered here.
        if (r.kind !== "drop") {
          const v = (agreedPickup[r.id] ?? "").trim();
          if (!v) { setError("Enter the pickup time agreed with the customer on the call."); return; }
          agreed.agreedPickupAt = v;
        }
        if (r.kind !== "pickup") {
          const v = (agreedDrop[r.id] ?? "").trim();
          if (!v) { setError("Enter the dropoff time agreed with the customer on the call."); return; }
          agreed.agreedDropAt = v;
        }
      }
      await setPickupStatus(r.id, status, notes[r.id] ?? r.staffNote, agreed);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't update the request.");
    } finally { setBusy(null); }
  }

  return (
    <div className="ax-page ax-pu">
      <header className="ax-page-head">
        <div>
          <p className="ax-label">Studio service</p>
          <h1>Pickup and drop</h1>
        </div>
        <div className="ax-kpis" aria-label="At a glance">
          <div><span className="ax-kpi-v ax-kpi-v--accent">{counts.REQUESTED}</span><span className="ax-label">Waiting</span></div>
          <div><span className="ax-kpi-v">{counts.CONFIRMED}</span><span className="ax-label">Approved</span></div>
          <div><span className="ax-kpi-v ax-kpi-v--premium">{counts.DONE}</span><span className="ax-label">Done</span></div>
        </div>
      </header>

      <div className="ax-toolbar">
        <div className="ax-seg" role="group" aria-label="Show">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label} {counts[t.id]}</button>
          ))}
        </div>
        <p className="ax-pu-policy">Free within 3 km. 3 to 7 km is Rs 100 per leg (pickup Rs 100, drop Rs 100, both Rs 200), collected at the studio. Beyond 7 km the app asks customers to call. Requests without a shared location need the distance and fee confirmed by phone.</p>
      </div>

      {loadError ? <p role="alert" className="ax-pu-error">{loadError}</p> : null}
      {error ? <p role="alert" className="ax-pu-error">{error}</p> : null}

      {rows === null ? (
        <div className="ax-panel" role="status">Loading requests...</div>
      ) : shown.length === 0 ? (
        <div className="ax-empty"><p className="ax-title">{tab === "REQUESTED" ? "Nothing waiting" : "No requests here"}</p><p>{tab === "REQUESTED" ? "New pickup and drop requests from customers show up here." : "Try another tab."}</p></div>
      ) : (
        <div className="ax-pu-grid">
          {shown.map((r) => {
            const open = r.status === "REQUESTED" || r.status === "CONFIRMED";
            const askedPickup = r.requestedPickupTime || r.preferredTime;
            const asked: [string, string][] = [];
            if (r.kind !== "drop" && askedPickup) asked.push([r.kind === "both" ? "Pickup" : "Time", askedPickup]);
            if (r.kind !== "pickup" && r.requestedDropTime) asked.push([r.kind === "both" ? "Drop" : "Time", r.requestedDropTime]);
            if (typeof r.feePaise === "number") asked.push(["Fee", `${r.feePaise === 0 ? "Free" : `Rs ${r.feePaise / 100}`}${typeof r.distanceKm === "number" ? ` (${r.distanceKm} km)` : ""}`]);
            else asked.push(["Fee", "No location shared: confirm distance by phone"]);
            const agreed: [string, string][] = [];
            if (r.status !== "REQUESTED" && r.agreedPickupAt) agreed.push(["Pickup", formatAgreed(r.agreedPickupAt)]);
            if (r.status !== "REQUESTED" && r.agreedDropAt) agreed.push(["Drop", formatAgreed(r.agreedDropAt)]);
            return (
              <section key={r.id} className="ax-panel ax-pu-card">
                <div className="ax-pu-top">
                  <h2>{KIND[r.kind]}</h2>
                  <StatusBadge label={STATUS_LABEL[r.status]} />
                </div>
                <p className="ax-pu-addr">{r.address}</p>

                {asked.length > 0 || agreed.length > 0 ? (
                  <dl className="ax-pu-facts">
                    {asked.length > 0 ? (
                      <div><dt>Customer asked</dt>{asked.map(([k, v]) => <dd key={k}>{asked.length > 1 ? <span>{k}</span> : null}{v}</dd>)}</div>
                    ) : null}
                    {agreed.length > 0 ? (
                      <div><dt>Agreed</dt>{agreed.map(([k, v]) => <dd key={k}>{agreed.length > 1 ? <span>{k}</span> : null}{v}</dd>)}</div>
                    ) : null}
                  </dl>
                ) : null}

                {r.status === "REQUESTED" ? (
                  <div className="ax-pu-form">
                    <p className="ax-pu-hint">Call the customer, agree the time, then enter it here.</p>
                    <div className="ax-pu-times">
                      {r.kind !== "drop" ? (
                        <label>Pickup time
                          <input type="datetime-local" aria-label="Agreed pickup time" value={agreedPickup[r.id] ?? ""} onChange={(e) => setAgreedPickup({ ...agreedPickup, [r.id]: e.target.value })} />
                        </label>
                      ) : null}
                      {r.kind !== "pickup" ? (
                        <label>Drop time
                          <input type="datetime-local" aria-label="Agreed dropoff time" value={agreedDrop[r.id] ?? ""} onChange={(e) => setAgreedDrop({ ...agreedDrop, [r.id]: e.target.value })} />
                        </label>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {open ? (
                  <textarea rows={1} aria-label="Note for the customer" placeholder="Note for the customer" value={notes[r.id] ?? r.staffNote} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} maxLength={300} className="ax-pu-note" />
                ) : r.staffNote ? <p className="ax-pu-staffnote">{r.staffNote}</p> : null}

                <div className="ax-pu-foot">
                  <Link href={`/bookings/${r.bookingId}`} className="ax-linkbtn">Open booking</Link>
                  {open ? (
                    <div className="ax-pu-actions">
                      <button type="button" className="ax-button" disabled={busy !== null} onClick={() => void act(r, "DECLINED")}>Decline</button>
                      {r.status === "REQUESTED"
                        ? <button type="button" className="ax-button ax-button--primary" disabled={busy !== null} onClick={() => void act(r, "CONFIRMED")}>Approve</button>
                        : <button type="button" className="ax-button ax-button--primary" disabled={busy !== null} onClick={() => void act(r, "DONE")}>Mark done</button>}
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
