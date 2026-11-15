"use client";
import{RetainedTransportActions}from"../../../components/RetainedTransportActions";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listenToPickupRequests, setPickupStatus, type PickupRequestRow } from "../../../lib/pickup-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { doneLegLines, outstandingLegNote } from "../../../lib/pickup-leg-display";
import { listenToBookings, BOOKINGS_LIST_LIMIT } from "../../../lib/bookings-service";
import { pickupRowState, pickupCounts, pickupTabCount } from "../../../lib/pickup-booking-state";
import {PICKUP_FREE_ROAD_METERS,PICKUP_ROAD_RATE_PER_KM_PAISE}from"@autodeck/core";
import {RETAINED_TRANSPORT_PREVIEW,useRetainedTransportPreview}from'../../../lib/use-retained-transport-preview';
import{retainedTransportLabel}from'@autodeck/core';
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
  const { claims, user } = useAdminAuth();
  const [rows, setRows] = useState<PickupRequestRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("REQUESTED");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [agreedPickup, setAgreedPickup] = useState<Record<string, string>>({});
  const [agreedDrop, setAgreedDrop] = useState<Record<string, string>>({});
  const [fees, setFees] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowsScope,setRowsScope]=useState("");
  const scope=JSON.stringify([user?.uid,claims?.role,claims?.tenantId,claims?.studioId]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!claims) return;
    setLoadError(null);setRows(null);setRowsScope("");let active=true;
    const stop=listenToPickupRequests(claims.tenantId, value=>{if(active){setRows(value);setRowsScope(scope)}}, () => { if(active){setLoadError("Couldn't load pickup requests."); setRows(null);setRowsScope("");} });return()=>{active=false;stop()};
  }, [claims,scope]);

  // Booking status per request, so a request for a cancelled booking is flagged instead of looking approvable.
  const [bookingStatus, setBookingStatus] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!claims || RETAINED_TRANSPORT_PREVIEW) return;
    return listenToBookings(claims.tenantId, (bs) => setBookingStatus(Object.fromEntries(bs.map((b) => [b.id, b.status]))), () => setBookingStatus(null));
  }, [claims]);

  const verified=useRetainedTransportPreview(claims&&user?JSON.stringify([user.uid,claims.role,claims.tenantId,claims.studioId]):null,rowsScope===scope?rows?.map(r=>r.id)??null:null);
  const physical=new Map(verified.status==='ready'?verified.data.batch.rows.filter(r=>r.kind==='retained').map(r=>[r.requestId,r.physical]):[]);
  const exactBookings=RETAINED_TRANSPORT_PREVIEW?(verified.status==='ready'?Object.fromEntries(verified.data.bookings.map(b=>[b.requestId,b.status])):null):bookingStatus;
  const visibleReady=!RETAINED_TRANSPORT_PREVIEW||rowsScope===scope&&verified.status==='ready';
  const displayStatus=(r:PickupRequestRow):Status=>physical.get(r.id)?.placement==='history'?'DONE':r.status;
  const counts = pickupCounts(visibleReady?(rows??[]).filter(r=>!physical.has(r.id)):[],exactBookings,RETAINED_TRANSPORT_PREVIEW?Number.MAX_SAFE_INTEGER:BOOKINGS_LIST_LIMIT);
  if(RETAINED_TRANSPORT_PREVIEW&&visibleReady)for(const r of rows??[]){const p=physical.get(r.id);if(p){counts.ALL++;counts[p.placement==='history'?'DONE':r.status]++;}}

  const needsClosure = counts.closeRequested + counts.closeConfirmed;
  const shown = visibleReady?(rows ?? []).filter((r) => tab === 'ALL' || displayStatus(r) === tab):[];

  async function act(r: PickupRequestRow, status: Status) {
    if (busy || RETAINED_TRANSPORT_PREVIEW && (!visibleReady || physical.has(r.id))) return;
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
      // No pin shared: the fee is unknown until the distance is agreed on the call. Admin enters it here (whole request, in rupees).
      let feePaise: number | undefined;
      const feeRaw = (fees[r.id] ?? "").trim();
      if (status === "CONFIRMED" && r.status === "REQUESTED" && (r.feePaise === null || r.feePaise === undefined) && feeRaw !== "") {
        const n = Math.round(Number(feeRaw) * 100);
        if (!Number.isFinite(n) || n < 0 || n > 100000) { setError("Enter the pickup fee in rupees, for example 150."); return; }
        feePaise = n;
      }
      await setPickupStatus(r.id, status, notes[r.id] ?? r.staffNote, agreed, feePaise);
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
          <div><span className="ax-kpi-v ax-kpi-v--accent">{visibleReady?pickupTabCount(counts,"REQUESTED"):"-"}</span><span className="ax-label">Waiting</span></div>
          <div><span className="ax-kpi-v">{visibleReady?pickupTabCount(counts,"CONFIRMED"):"-"}</span><span className="ax-label">Approved</span></div>
          <div><span className="ax-kpi-v ax-kpi-v--premium">{visibleReady?counts.DONE:"-"}</span><span className="ax-label">{RETAINED_TRANSPORT_PREVIEW?"History":"Done"}</span></div>
          {needsClosure > 0 ? <div><span className="ax-kpi-v">{needsClosure}</span><span className="ax-label">Needs closure</span></div> : null}
        </div>
      </header>

      <div className="ax-toolbar">
        <div className="ax-seg" role="group" aria-label="Show">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{RETAINED_TRANSPORT_PREVIEW&&t.id==="DONE"?"History":t.label} {visibleReady?pickupTabCount(counts,t.id):"-"}</button>
          ))}
        </div>
        <p className="ax-pu-policy">First {PICKUP_FREE_ROAD_METERS/1000} road km free per leg, then ₹{PICKUP_ROAD_RATE_PER_KM_PAISE/100} per extra km. Preserve each request's quoted fee and check the bill before collecting. Missing road-distance checks need review.</p>
      </div>

      {visibleReady&&(tab==="REQUESTED"||tab==="CONFIRMED")?<p className="ax-pu-hint" role="status">{counts[tab]} {RETAINED_TRANSPORT_PREVIEW?(counts[tab]===1?"journey":"journeys"):"ready to review"} · {tab==="REQUESTED"?counts.closeRequested:counts.closeConfirmed} need booking review</p>:null}
      {loadError ? <p role="alert" className="ax-pu-error">{loadError}</p> : null}
      {error ? <p role="alert" className="ax-pu-error">{error}</p> : null}

      {RETAINED_TRANSPORT_PREVIEW && verified.status==="unavailable" ? <div className="ax-panel" role="alert">Requests unavailable</div> : rows === null || !visibleReady ? (
        <div className="ax-panel" role="status">Loading requests...</div>
      ) : shown.length === 0 ? (
        <div className="ax-empty"><p className="ax-title">{tab === "REQUESTED" ? "Nothing waiting" : "No requests here"}</p><p>{tab === "REQUESTED" ? "New pickup and drop requests from customers show up here." : "Try another tab."}</p></div>
      ) : (
        <div className="ax-pu-grid">
          {shown.map((r) => {
            const retained=physical.get(r.id);
            const open = !retained && (r.status === "REQUESTED" || r.status === "CONFIRMED");
            const bookingNote = open ? pickupRowState(r, r.bookingId, exactBookings, RETAINED_TRANSPORT_PREVIEW?Number.MAX_SAFE_INTEGER:BOOKINGS_LIST_LIMIT) : { actionable: true, note: null };
            const blocked = !!retained || !bookingNote.actionable;
            const askedPickup = r.requestedPickupTime || r.preferredTime;
            const asked: [string, string][] = [];
            if (r.kind !== "drop" && askedPickup) asked.push([r.kind === "both" ? "Pickup" : "Time", askedPickup]);
            if (r.kind !== "pickup" && r.requestedDropTime) asked.push([r.kind === "both" ? "Drop" : "Time", r.requestedDropTime]);
            if (typeof r.feePaise === "number") {
              const billing = r.feePaise > 0 && (r.status === "CONFIRMED" || r.status === "DONE") ? (r.feeBilled ? ", added to the bill" : ", NOT on the bill (already invoiced or paid): review collection before proceeding") : "";
              asked.push([retained?"Original quote":"Fee", `${r.feePaise === 0 ? "Free" : `Rs ${r.feePaise / 100}`}${typeof r.distanceKm === "number" ? ` (${r.distanceKm} km)` : ""}${retained?"":billing}`]);
            }
            else asked.push(["Fee", "No location shared: confirm distance by phone"]);
            const agreed: [string, string][] = [];
            if (r.status !== "REQUESTED" && !retained?.unusedLegs.includes("pickup") && r.agreedPickupAt) agreed.push(["Pickup", formatAgreed(r.agreedPickupAt)]);
            if (r.status !== "REQUESTED" && !retained?.unusedLegs.includes("drop") && r.agreedDropAt) agreed.push(["Drop", formatAgreed(r.agreedDropAt)]);
            const legLines = doneLegLines(r, formatAgreed);
            const legNote = retained?null:outstandingLegNote(r);
            return (
              <section key={r.id} className="ax-panel ax-pu-card">
                <div className="ax-pu-top">
                  <h2>{KIND[r.kind]}</h2>
                  <StatusBadge label={retained?retainedTransportLabel(retained):blocked?"Needs booking review":STATUS_LABEL[r.status]} />
                </div>
                <p className="ax-pu-addr">{r.address}</p>

                {asked.length > 0 || agreed.length > 0 ? (
                  <dl className="ax-pu-facts">
                    {asked.length > 0 ? (
                      <div><dt>Customer asked</dt>{asked.map(([k, v]) => <dd key={k}>{asked.length > 1 || retained ? <span>{k}</span> : null}{v}</dd>)}</div>
                    ) : null}
                    {agreed.length > 0 ? (
                      <div><dt>Agreed</dt>{agreed.map(([k, v]) => <dd key={k}>{agreed.length > 1 ? <span>{k}</span> : null}{v}</dd>)}</div>
                    ) : null}
                  </dl>
                ) : null}

                {!retained && r.status === "REQUESTED" ? (
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
                    {r.feePaise === null || r.feePaise === undefined ? (
                      <label>Fee for this request (Rs, whole request)
                        <input inputMode="numeric" aria-label="Pickup fee in rupees" placeholder="Confirmed fee" value={fees[r.id] ?? ""} onChange={(e) => setFees({ ...fees, [r.id]: e.target.value })} />
                      </label>
                    ) : null}
                  </div>
                ) : null}

                {legLines.length > 0 ? (
                  <dl className="ax-pu-facts">
                    <div><dt>Studio recorded</dt>{legLines.map(([k, v]) => <dd key={k}><span>{k}</span>{v}</dd>)}{legNote ? <dd>{legNote}</dd> : null}</div>
                  </dl>
                ) : null}

                {open ? (
                  <textarea rows={1} aria-label="Note for the customer" placeholder="Note for the customer" value={notes[r.id] ?? r.staffNote} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} maxLength={300} className="ax-pu-note" />
                ) : r.staffNote ? <p className="ax-pu-staffnote">{r.staffNote}</p> : null}

                {bookingNote.note ? <p className="ax-pu-staffnote" role="note">{bookingNote.note}</p> : null}
                {retained?.placement==='active'?<RetainedTransportActions key={scope+JSON.stringify(retained)} requestId={r.id}/>:null}
                <div className="ax-pu-foot">
                  <Link href={`/bookings/${r.bookingId}`} className="ax-linkbtn">Open booking</Link>
                  {open ? (
                    <div className="ax-pu-actions">
                      <button type="button" className="ax-button" disabled={busy !== null} onClick={() => void act(r, "DECLINED")}>Decline</button>
                      {r.status === "REQUESTED"
                        ? <button type="button" className="ax-button ax-button--primary" disabled={busy !== null || blocked} onClick={() => void act(r, "CONFIRMED")}>Approve</button>
                        : <button type="button" className="ax-button ax-button--primary" disabled={busy !== null || blocked} onClick={() => void act(r, "DONE")}>Mark done</button>}
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
