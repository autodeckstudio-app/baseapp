"use client";
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import type { ServiceJob, StudioConfig } from "@autodeck/core";
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { functions, db } from "../lib/firebase";

type Slot = { date: string; startTime: string; startAt: string };
const NEXT: Record<string, string> = { PENDING_VEHICLE: "Check in vehicle", VEHICLE_RECEIVED: "Start work", IN_PROGRESS: "Send to QC", QUALITY_CHECK: "Mark ready", READY_FOR_DELIVERY: "Mark delivered" };
const label = (slot: Slot) => new Date(slot.startAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + " IST";

export function JobControls({ job }: { job: ServiceJob }) {
  const [bays, setBays] = useState<{id: string; name: string}[]>([]);
  const [operation, setOperation] = useState<"enqueue" | "admit" | "rework" | null>(null);
  const [bay, setBay] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [pick, setPick] = useState<Slot | null>(null);
  const [advanceConfirm, setAdvanceConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function prepareStandby() {
    setOperation("admit"); setBusy(true); setError(null);
    try {
      const [c, s] = await Promise.all([getDoc(doc(db, COLLECTIONS.studioConfig(), job.studioId)), getDoc(doc(db, COLLECTIONS.services(), job.serviceId))]);
      const config = c.data() as StudioConfig | undefined;
      setBays((config?.bays ?? []).filter(b => b.active && b.bayType === s.data()?.requiredBayType));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load bays."); }
    finally { setBusy(false); }
  }
  async function perform() {
    setBusy(true); setError(null);
    try {
      if (operation === "rework") await httpsCallable(functions, "advanceJobStatus")({ jobId: job.id, rework: true });
      else await httpsCallable(functions, "standbyBooking")({ jobId: job.id, action: operation, ...(operation === "admit" ? { bayId: bay } : {}) });
      setOperation(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update job."); }
    finally { setBusy(false); }
  }
  async function loadSlots() {
    setOpen(true); setBusy(true); setError(null); setPick(null); setDone(null);
    try {
      const startDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const result = await httpsCallable<unknown, { slots: Slot[] }>(functions, "getAvailability")({ serviceId: job.serviceId, studioId: job.studioId, startDate, lookAheadDays: 14 });
      setSlots(result.data.slots.filter(slot => Date.parse(slot.startAt) > Date.now()));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load upcoming slots."); }
    finally { setBusy(false); }
  }
  async function advance() {
    setBusy(true); setError(null); setDone(null);
    try { await httpsCallable(functions, "advanceJobStatus")({ jobId: job.id }); setAdvanceConfirm(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update the stage."); }
    finally { setBusy(false); }
  }
  async function move() {
    if (!pick || !job.bookingId) return;
    setBusy(true); setError(null);
    try {
      await httpsCallable(functions, "rescheduleBooking")({ bookingId: job.bookingId, newDate: pick.date, newTime: pick.startTime, idempotencyKey: `admin-${job.id}-${Date.now()}` });
      setOpen(false); setPick(null); setDone("Booking rescheduled. The booking and job now use the new slot.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not reschedule. Reload the available times."); }
    finally { setBusy(false); }
  }
  const next = NEXT[job.status];
  if (!next && job.status !== "STANDBY") return null;
  return <section className="ax-card" style={{ display: "grid", gap: 12, padding: 20 }}>
    <h2 className="ax-label">Job controls</h2>
    {error ? <p role="alert">{error}</p> : null}
    {done ? <p role="status">{done}</p> : null}
    {operation ? <div style={{display: "grid", gap: 8}}>
      <p>{operation === "enqueue" ? "Mark arrived - standby? This releases the old bay reservation. No slot or service start is promised." : operation === "rework" ? "Send back to Work in progress for QC rework?" : "Admit the next standby car at the actual time? The server checks queue order, bay occupancy and upcoming reservations."}</p>
      {operation === "admit" ? <select aria-label="Standby bay" value={bay} onChange={e => setBay(e.target.value)}><option value="">Choose a compatible bay</option>{bays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select> : null}
      <button className="ax-button ax-button--primary" disabled={busy || (operation === "admit" && !bay)} onClick={() => void perform()}>Confirm {operation === "enqueue" ? "standby arrival" : operation === "rework" ? "QC rework" : "admission"}</button>
      <button className="ax-button" disabled={busy} onClick={() => setOperation(null)}>Cancel</button>
    </div> : null}
    {job.status === "STANDBY" ? <><p>Waiting since {new Date(job.standbyArrivedAt ?? job.createdAt).toLocaleString("en-IN", {timeZone: "Asia/Kolkata"})}. No bay or time reserved.</p><button className="ax-button ax-button--primary" disabled={busy} onClick={() => void prepareStandby()}>Admit from standby</button></> : null}
    {job.status === "PENDING_VEHICLE" && job.bookingId ? <button className="ax-button" disabled={busy || Date.parse(job.scheduledAt) > Date.now()} onClick={() => setOperation("enqueue")}>Arrived - standby</button> : null}
    {job.status === "QUALITY_CHECK" ? <button className="ax-button" disabled={busy} onClick={() => setOperation("rework")}>QC failed - send for rework</button> : null}
    {job.status === "READY_FOR_DELIVERY" && job.paymentStatus !== "paid" ? <p role="status">Collect and confirm full payment before marking delivered.</p> : null}
    {next ? <>{advanceConfirm ? <div style={{ display: "grid", gap: 8 }}><p>{next}? This updates the studio, admin and customer tracker.</p><button className="ax-button ax-button--primary" disabled={busy} onClick={() => void advance()}>Confirm {next.toLowerCase()}</button><button className="ax-button" disabled={busy} onClick={() => setAdvanceConfirm(false)}>Cancel</button></div> : <button className="ax-button ax-button--primary" disabled={busy || (job.status === "READY_FOR_DELIVERY" && job.paymentStatus !== "paid")} onClick={() => setAdvanceConfirm(true)}>{next}</button>}</> : null}
    {job.status === "PENDING_VEHICLE" && job.bookingId ? <>
      <p>Late arrival? Move this booking to an upcoming available slot before checking in. The same booking and job are kept.</p>
      {!open ? <button className="ax-button" disabled={busy} onClick={() => void loadSlots()}>Reschedule</button> : <>
        {busy ? <p role="status">Loading or saving...</p> : null}
        {!busy && !error && slots.length === 0 ? <p>No upcoming slots in the next 14 days.</p> : null}
        <div style={{ display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" }}>{slots.map(slot => <button key={slot.startAt} className={pick?.startAt === slot.startAt ? "ax-button ax-button--primary" : "ax-button"} aria-pressed={pick?.startAt === slot.startAt} disabled={busy} onClick={() => setPick(slot)}>{label(slot)}</button>)}</div>
        {pick ? <><p>Move this booking to {label(pick)}? Bay capacity will be checked again before saving.</p><button className="ax-button ax-button--primary" disabled={busy} onClick={() => void move()}>Confirm reschedule</button></> : null}
        <button className="ax-button" disabled={busy} onClick={() => void loadSlots()}>Reload available times</button>
        <button className="ax-button" disabled={busy} onClick={() => { setOpen(false); setPick(null); }}>Cancel</button>
      </>}
    </> : null}
  </section>;
}
