"use client";

import { useCallback, useEffect, useState } from "react";
import { listPickupRequests, setPickupStatus, type PickupRequestRow } from "../../../lib/pickup-service";
import { useAdminAuth } from "../../../lib/auth-context";

const KIND = { pickup: "Pick up", drop: "Drop back", both: "Pick up and drop back" } as const;
const STATUS = { REQUESTED: "Waiting for approval", CONFIRMED: "Approved", DONE: "Done", DECLINED: "Declined" } as const;
const box = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 16, display: "grid", gap: 8 } as const;
const btn = { borderRadius: 9999, padding: "10px 18px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" } as const;

export default function PickupsPage() {
  const { claims } = useAdminAuth();
  const [rows, setRows] = useState<PickupRequestRow[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!claims) return;
    try { setRows(await listPickupRequests(claims.tenantId)); } catch { setError("Couldn't load pickup requests."); setRows([]); }
  }, [claims]);
  useEffect(() => { void load(); }, [load]);

  async function act(r: PickupRequestRow, status: PickupRequestRow["status"]) {
    setBusy(r.id); setError(null);
    try { await setPickupStatus(r.id, status, notes[r.id] ?? r.staffNote); await load(); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : "Couldn't update the request."); }
    finally { setBusy(null); }
  }

  return (
    <main style={{ display: "grid", gap: 16, maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ margin: 0 }}>Pickup and drop</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>Free up to 5 km. Beyond 5 km it is Rs 100 per pickup and Rs 100 per drop. Write the charge in the note when you approve. The customer sees it on their booking and pays at the studio.</p>
      {error ? <p role="alert" style={{ color: "#ff8a7a" }}>{error}</p> : null}
      {rows === null ? <p>Loading...</p> : rows.length === 0 ? <p>No pickup or drop requests yet.</p> : rows.map((r) => (
        <section key={r.id} style={box}>
          <strong>{KIND[r.kind]} - {STATUS[r.status]}</strong>
          <span>{r.address}</span>
          {r.preferredTime ? <span style={{ opacity: 0.7 }}>Preferred: {r.preferredTime}</span> : null}
          <span style={{ opacity: 0.5, fontSize: 12 }}>Booking {r.bookingId}</span>
          {r.status === "REQUESTED" || r.status === "CONFIRMED" ? (
            <>
              <input aria-label="Note or charge for the customer" placeholder={`Charge if beyond 5 km (e.g. Rs ${r.kind === "both" ? 200 : 100})`} value={notes[r.id] ?? r.staffNote} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} maxLength={300} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "inherit", font: "inherit" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {r.status === "REQUESTED" ? <button style={{ ...btn, background: "#EC8638", color: "#1A1410", borderColor: "#EC8638" }} disabled={busy === r.id} onClick={() => void act(r, "CONFIRMED")}>Approve</button> : null}
                {r.status === "CONFIRMED" ? <button style={{ ...btn, background: "#EC8638", color: "#1A1410", borderColor: "#EC8638" }} disabled={busy === r.id} onClick={() => void act(r, "DONE")}>Mark done</button> : null}
                <button style={btn} disabled={busy === r.id} onClick={() => void act(r, "DECLINED")}>Decline</button>
              </div>
            </>
          ) : r.staffNote ? <span style={{ opacity: 0.7 }}>Note: {r.staffNote}</span> : null}
        </section>
      ))}
    </main>
  );
}
