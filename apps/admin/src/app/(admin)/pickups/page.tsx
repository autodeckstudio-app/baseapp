"use client";

import { useCallback, useEffect, useState } from "react";
import { listPickupRequests, setPickupStatus, type PickupRequestRow } from "../../../lib/pickup-service";
import { useAdminAuth } from "../../../lib/auth-context";

const KIND = { pickup: "Pick up", drop: "Drop back", both: "Pick up and drop back" } as const;
const STATUS = { REQUESTED: "Waiting for approval", CONFIRMED: "Approved", DONE: "Done", DECLINED: "Declined" } as const;
const box = { background: "var(--ad-surface)", border: "1px solid var(--ad-border-subtle)", borderRadius: 20, padding: 16, display: "grid", gap: 8 } as const;
const btn = { borderRadius: 9999, padding: "10px 18px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" } as const;

export default function PickupsPage() {
  const { claims } = useAdminAuth();
  const [rows, setRows] = useState<PickupRequestRow[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [agreedPickup, setAgreedPickup] = useState<Record<string, string>>({});
  const [agreedDrop, setAgreedDrop] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!claims) return;
    setError(null);
    try { setRows(await listPickupRequests(claims.tenantId)); } catch { setError("Couldn't load pickup requests."); setRows([]); }
  }, [claims]);
  useEffect(() => { void load(); }, [load]);

  async function act(r: PickupRequestRow, status: PickupRequestRow["status"]) {
    if(busy) return;
    setBusy(r.id); setError(null);
    try {
      const agreed: { agreedPickupAt?: string; agreedDropAt?: string } = {};
      if (status === "CONFIRMED") {
        // Timing is agreed with the customer by phone call; it must be entered here.
        if (r.kind !== "drop") {
          const v = (agreedPickup[r.id] ?? "").trim();
          if (!v) { setError("Enter the pickup time agreed with the customer on the call."); setBusy(null); return; }
          agreed.agreedPickupAt = v;
        }
        if (r.kind !== "pickup") {
          const v = (agreedDrop[r.id] ?? "").trim();
          if (!v) { setError("Enter the dropoff time agreed with the customer on the call."); setBusy(null); return; }
          agreed.agreedDropAt = v;
        }
      }
      await setPickupStatus(r.id, status, notes[r.id] ?? r.staffNote, agreed);
      await load();
    }
    catch (e) { setError(e instanceof Error && e.message ? e.message : "Couldn't update the request."); }
    finally { setBusy(null); }
  }

  const dtInput = { padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "var(--ad-surface)", color: "inherit", font: "inherit", colorScheme: "dark" } as const;

  function formatAgreed(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} at ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
  }

  return (
    <main style={{ display: "grid", gap: 16, maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ margin: 0 }}>Pickup and drop</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>Free up to 5 km. Beyond 5 km it is Rs 100 per pickup and Rs 100 per drop. Write the charge in the note when you approve. The customer sees it on their booking and pays at the studio.</p>
      {error ? <div><p role="alert" style={{color:"var(--ad-danger)"}}>{error}</p><button className="ax-button" onClick={()=>void load()}>Retry</button></div> : null}
      {rows === null ? <p>Loading...</p> : rows.length === 0 ? <p>No pickup or drop requests yet.</p> : rows.map((r) => (
        <section key={r.id} style={box}>
          <strong>{KIND[r.kind]} - {STATUS[r.status]}</strong>
          <span>{r.address}</span>
          {r.kind !== "drop" && (r.requestedPickupTime || r.preferredTime) ? <span style={{ opacity: 0.7 }}>Customer asked{r.kind === "both" ? " (pickup)" : ""}: {r.requestedPickupTime || r.preferredTime}</span> : null}
          {r.kind !== "pickup" && r.requestedDropTime ? <span style={{ opacity: 0.7 }}>Customer asked (dropoff): {r.requestedDropTime}</span> : null}
          {r.status !== "REQUESTED" && r.agreedPickupAt ? <span style={{ opacity: 0.7 }}>Pickup agreed: {formatAgreed(r.agreedPickupAt)}</span> : null}
          {r.status !== "REQUESTED" && r.agreedDropAt ? <span style={{ opacity: 0.7 }}>Dropoff agreed: {formatAgreed(r.agreedDropAt)}</span> : null}
          <span style={{ opacity: 0.5, fontSize: 12 }}>Booking {r.bookingId}</span>
          {r.status === "REQUESTED" || r.status === "CONFIRMED" ? (
            <>
              {r.status === "REQUESTED" ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ opacity: 0.7, fontSize: 13 }}>Agree the time with the customer by phone call, then enter it here.</span>
                  {r.kind !== "drop" ? (
                    <label style={{ display: "grid", gap: 4, fontSize: 13, opacity: 0.9 }}>
                      Agreed pickup time
                      <input type="datetime-local" aria-label="Agreed pickup time" value={agreedPickup[r.id] ?? ""} onChange={(e) => setAgreedPickup({ ...agreedPickup, [r.id]: e.target.value })} style={dtInput} />
                    </label>
                  ) : null}
                  {r.kind !== "pickup" ? (
                    <label style={{ display: "grid", gap: 4, fontSize: 13, opacity: 0.9 }}>
                      Agreed dropoff time
                      <input type="datetime-local" aria-label="Agreed dropoff time" value={agreedDrop[r.id] ?? ""} onChange={(e) => setAgreedDrop({ ...agreedDrop, [r.id]: e.target.value })} style={dtInput} />
                    </label>
                  ) : null}
                </div>
              ) : null}
              <textarea rows={3} aria-label="Note or charge for the customer" placeholder={`Charge if beyond 5 km (e.g. Rs ${r.kind === "both" ? 200 : 100})`} value={notes[r.id] ?? r.staffNote} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} maxLength={300} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "var(--ad-surface)", color: "inherit", font: "inherit", width:"100%",boxSizing:"border-box",resize:"vertical" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {r.status === "REQUESTED" ? <button style={{ ...btn, background: "#EC8638", color: "#1A1410", borderColor: "#EC8638" }} disabled={busy !== null} onClick={() => void act(r, "CONFIRMED")}>Approve</button> : null}
                {r.status === "CONFIRMED" ? <button style={{ ...btn, background: "#EC8638", color: "#1A1410", borderColor: "#EC8638" }} disabled={busy !== null} onClick={() => void act(r, "DONE")}>Mark done</button> : null}
                <button style={btn} disabled={busy !== null} onClick={() => void act(r, "DECLINED")}>Decline</button>
              </div>
            </>
          ) : r.staffNote ? <span style={{ opacity: 0.7 }}>Note: {r.staffNote}</span> : null}
        </section>
      ))}
    </main>
  );
}

