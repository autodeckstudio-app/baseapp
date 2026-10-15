"use client";

// Text chat with the customer on one job. Replies go to the customer as a push. Text only.
import { useEffect, useState } from "react";
import { canMessageJob, cleanJobMessage, JOB_MESSAGE_MAX, type JobMessage, type ServiceJob } from "@autodeck/core";
import { listenToJobMessages, sendJobMessage } from "../lib/job-chat-service";

export function JobChatPanel({ job, tenantId }: { job: ServiceJob; tenantId: string }) {
  const [msgs, setMsgs] = useState<JobMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Until the chat rules are deployed the read is denied. Show nothing rather than an error on every job.
  const [unavailable, setUnavailable] = useState(false);
  const open = canMessageJob(job, Date.now());
  useEffect(() => listenToJobMessages(job.id, tenantId, job.customerId, setMsgs, () => setUnavailable(true)), [job.id, tenantId, job.customerId]);
  if (unavailable || (!open && msgs.length === 0)) return null;
  async function send() {
    const c = cleanJobMessage(text);
    if (!c.ok) { setError(c.error); return; }
    setBusy(true); setError(null);
    try { await sendJobMessage(job.id, c.text); setText(""); } catch (e) { setError(e instanceof Error && e.message ? e.message : "The message did not send."); } finally { setBusy(false); }
  }
  return (
    <section className="ax-panel">
      <span className="ax-label">Messages with the customer</span>
      {msgs.length === 0 ? <p className="ax-note">No messages yet.</p> : (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
          {msgs.map((m) => (
            <li key={m.id} style={{ justifySelf: m.sender === "studio" ? "end" : "start", maxWidth: "85%", padding: "8px 12px", borderRadius: 16, background: m.sender === "studio" ? "rgba(236,134,56,.16)" : "rgba(29,27,38,.07)" }}>
              <div>{m.text}</div>
              <span className="ax-sub">{m.sender === "studio" ? "Studio" : "Customer"}, {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="ax-note" role="alert">{error}</p> : null}
      {open ? (
        <div className="ax-form-section">
          <textarea value={text} maxLength={JOB_MESSAGE_MAX} rows={2} placeholder="Reply to the customer" aria-label="Reply" onChange={(e) => setText(e.target.value)} disabled={busy} />
          <button type="button" className="ax-button ax-button--primary" disabled={busy || !text.trim()} onClick={() => void send()}>Send</button>
        </div>
      ) : <p className="ax-note">This chat is closed.</p>}
    </section>
  );
}
