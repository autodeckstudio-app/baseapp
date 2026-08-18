"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuditLog } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToAuditLog } from "../../../lib/audit-service";
import { formatDateTime } from "../../../lib/format";

export default function AuditPage() {
  const { claims } = useAdminAuth();
  const [entries, setEntries] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!claims) return undefined;
    setLoading(true);
    return listenToAuditLog(
      claims.tenantId,
      (data) => {
        setEntries(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [claims]);

  const actions = useMemo(() => Array.from(new Set(entries.map((e) => e.action))).sort(), [entries]);
  const entityTypes = useMemo(() => Array.from(new Set(entries.map((e) => e.entityType))).sort(), [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (actor && !e.performedBy.toLowerCase().includes(actor.toLowerCase())) return false;
      if (action && e.action !== action) return false;
      if (entityType && e.entityType !== entityType) return false;
      if (entityId && !e.entityId.toLowerCase().includes(entityId.toLowerCase())) return false;
      if (date && e.createdAt.slice(0, 10) !== date) return false;
      return true;
    });
  }, [entries, actor, action, entityType, entityId, date]);

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Audit Log</h1>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Append-only. No entry can be edited or deleted from this or any other interface.</p>

      <div className="filter-bar">
        <input placeholder="Actor (uid)" value={actor} onChange={(e) => setActor(e.target.value)} style={{ width: 160 }} />
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">All entity types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input placeholder="Entity ID (booking/job/payment/invoice/customer/vehicle)" value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ width: 260 }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtered.length} of {entries.length}</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p>No audit entries match these filters.</p>
      ) : (
        <table>
          <thead>
            <tr><th>When</th><th>Action</th><th>Entity</th><th>By</th><th>Role</th></tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="row-link" onClick={() => setSelected(e)}>
                <td>{formatDateTime(e.createdAt)}</td>
                <td>{e.action}</td>
                <td>{e.entityType} · {e.entityId}</td>
                <td>{e.performedBy}</td>
                <td>{e.performedByRole}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "flex-end", zIndex: 10 }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ width: 420, maxWidth: "90vw", height: "100%", background: "var(--color-surface)", padding: "var(--space-xl)", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setSelected(null)}>Close</button>
            <h2>{selected.action}</h2>
            <div className="kv"><span>Entity</span><span>{selected.entityType} · {selected.entityId}</span></div>
            <div className="kv"><span>Performed by</span><span>{selected.performedBy} ({selected.performedByRole})</span></div>
            <div className="kv"><span>Studio</span><span>{selected.studioId ?? "— (tenant-level)"}</span></div>
            <div className="kv"><span>When</span><span>{formatDateTime(selected.createdAt)}</span></div>
            <h3>Before</h3>
            <pre style={{ background: "var(--color-surface-sunken)", padding: 12, borderRadius: 8, overflowX: "auto", fontSize: 12 }}>
              {selected.before ? JSON.stringify(selected.before, null, 2) : "—"}
            </pre>
            <h3>After</h3>
            <pre style={{ background: "var(--color-surface-sunken)", padding: 12, borderRadius: 8, overflowX: "auto", fontSize: 12 }}>
              {selected.after ? JSON.stringify(selected.after, null, 2) : "—"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
