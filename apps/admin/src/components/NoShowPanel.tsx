"use client";

// No-show review for a booking the close-time sweep auto-cancelled: contact
// log, then an explicit resolution. The server surfaces the delegated-policy
// candidates (flat Rs 100 / 20% / waiver) and preselects none - the admin
// picks one, sees the exact refund, types a reason, and confirms. Money moves
// only through the refund outbox reservation, never inline here.
import { useEffect, useState } from "react";
import type { Booking } from "@autodeck/core";
import { recordNoShowContact, previewNoShowResolution, resolveNoShow, type NoShowPreview } from "../lib/bookings-service";
import { formatPaise } from "../lib/format";

const CHANNELS = [
  { key: "phone", label: "Phone call" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "in_person", label: "In person" },
] as const;

export function NoShowPanel({ booking, onError }: { booking: Booking; onError: (m: string | null) => void }) {
  const [preview, setPreview] = useState<NoShowPreview | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<"phone" | "whatsapp" | "in_person">("phone");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const resolved = (booking as { noShowResolution?: string }).noShowResolution;
  const contactLog = ((booking as { noShowContactLog?: Array<{ at: string; channel: string; note: string }> }).noShowContactLog) ?? [];

  useEffect(() => {
    if (resolved) return;
    previewNoShowResolution(booking.id).then(setPreview).catch((e) => onError(e instanceof Error ? e.message : "Could not load the no-show preview."));
  }, [booking.id, resolved, onError]);

  async function saveContact() {
    setBusy(true);
    try {
      await recordNoShowContact(booking.id, channel, note.trim());
      setNote("");
      onError(null);
      window.location.reload();
    } catch (e) { onError(e instanceof Error ? e.message : "Could not record the contact."); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!preview || !picked) return;
    const candidate = preview.candidates.find((c) => c.key === picked);
    if (!candidate) return;
    setBusy(true);
    try {
      await resolveNoShow({
        bookingId: booking.id,
        resolution: candidate.key === "waive" ? "waive" : "charge",
        chargePaise: candidate.chargePaise,
        reason: reason.trim(),
      });
      setDone("No-show resolved. The refund is queued, not yet sent to the payment provider.");
      onError(null);
    } catch (e) { onError(e instanceof Error ? e.message : "Could not resolve the no-show."); }
    finally { setBusy(false); }
  }

  if (resolved) {
    const chargePaise = (booking as { noShowChargePaise?: number | null }).noShowChargePaise ?? 0;
    const refundQueued = Boolean((booking as { noShowRefundRequestId?: string }).noShowRefundRequestId);
    return (
      <section className="ax-panel">
        <span className="ax-label">No-show</span>
        <div className="kv"><span>Resolution</span><span>{resolved}</span></div>
        {resolved === "charge" ? <div className="kv"><span>Charge kept</span><span className="ax-data">{formatPaise(chargePaise)}</span></div> : null}
        {refundQueued ? <div className="kv"><span>Refund</span><span>Queued, not yet sent to the payment provider</span></div> : null}
      </section>
    );
  }

  return (
    <section className="ax-panel">
      <span className="ax-label">No-show review</span>
      <p className="ax-note">The customer never arrived and the booking was auto-cancelled at studio close. Record how you tried to reach them, then decide the charge. {preview?.policyNote}</p>

      {contactLog.length > 0 ? (
        <div style={{ display: "grid", gap: 4, margin: "8px 0" }}>
          {contactLog.map((c, i) => <p key={i} className="ax-note">{new Date(c.at).toLocaleString("en-IN")} · {c.channel} · {c.note}</p>)}
        </div>
      ) : <p className="ax-note">No contact recorded yet.</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select className="ax-input" style={{ width: "auto" }} value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
          {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <input className="ax-input" style={{ flex: 1, minWidth: 180 }} placeholder="What was said?" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="ax-button" disabled={busy || note.trim().length < 3} onClick={() => void saveContact()}>Record contact</button>
      </div>

      {done ? <p role="status">{done}</p> : preview ? (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {preview.capturedPaise === 0 ? <p className="ax-note">No online payment was captured, so there is nothing to refund.</p> : null}
          {preview.candidates.map((c) => (
            <button key={c.key} type="button" className={picked === c.key ? "ax-button ax-button--primary" : "ax-button"} aria-pressed={picked === c.key} disabled={busy} onClick={() => setPicked(c.key)}>
              {c.key === "flat_rs100" ? "Charge Rs 100" : c.key === "pct_20" ? "Charge 20%" : "Waive the charge"}: keep {formatPaise(c.chargePaise)}, refund {formatPaise(c.refundPaise)}
            </button>
          ))}
          {picked ? (
            <>
              <input className="ax-input" placeholder="Reason for this decision (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button type="button" className="ax-button ax-button--primary" disabled={busy || reason.trim().length < 3} onClick={() => void confirm()}>Confirm resolution</button>
            </>
          ) : null}
        </div>
      ) : <p role="status">Loading the resolution options...</p>}
    </section>
  );
}
