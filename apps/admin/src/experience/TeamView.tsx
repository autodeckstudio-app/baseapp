"use client";

// Team: who can sign in and what they see. Studio staff get the floor app;
// Office staff get everything. Access is by Google account on this roster.
import { useState } from "react";
import type { Employee } from "@autodeck/core";
import { PageHead } from "./Office";

type Role = "studio" | "admin";
const ROLE_NAME: Record<Role, string> = { studio: "Studio", admin: "Office" };
const ROLE_HINT: Record<Role, string> = { studio: "Floor app: bookings and jobs", admin: "Everything, including money and team" };

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export function TeamView(p: {
  staff: Employee[];
  loading: boolean;
  error: string | null;
  message: string | null;
  busy: boolean;
  onAdd: (input: { name: string; email: string; role: Role }) => void;
  onRole: (emp: Employee, role: Role) => void;
  onRemove: (emp: Employee) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("studio");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const current = p.staff.filter((s) => !s.terminatedAt);
  const past = p.staff.filter((s) => s.terminatedAt);
  const waiting = current.filter((s) => !s.authUid).length;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Office"
        title="Team"
        kpis={[
          { value: current.filter((s) => s.role === "studio").length, label: "Studio" },
          { value: current.filter((s) => s.role === "admin").length, label: "Office", tone: "premium" },
          { value: waiting, label: "Not signed in yet", tone: waiting ? "accent" : undefined },
        ]}
      />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            <span className="ax-label">People with access</span>
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ax-skel ax-skel--row" />)
            ) : current.length === 0 ? (
              <p className="ax-note">No one on the team yet. Add the first person on the right.</p>
            ) : (
              <ul className="ax-people">
                {current.map((emp) => (
                  <li key={emp.id} className="ax-person">
                    <span className={`ax-avatar ax-avatar--${emp.role}`} aria-hidden="true">{initials(emp.name)}</span>
                    <span className="ax-person-main">
                      <span className="ax-person-name">{emp.name}</span>
                      <span className="ax-sub">{emp.email ?? emp.phone}{emp.authUid ? "" : " · hasn't signed in yet"}</span>
                    </span>
                    <select value={emp.role} onChange={(e) => p.onRole(emp, e.target.value as Role)} aria-label={`Access for ${emp.name}`} disabled={p.busy}>
                      <option value="studio">Studio</option>
                      <option value="admin">Office</option>
                    </select>
                    {confirmId === emp.id ? (
                      <span className="ax-row-actions">
                        <button type="button" className="ax-button ax-button--danger" disabled={p.busy} onClick={() => { p.onRemove(emp); setConfirmId(null); }}>Remove access</button>
                        <button type="button" className="ax-button" onClick={() => setConfirmId(null)}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" className="ax-button" onClick={() => setConfirmId(emp.id)}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section className="ax-panel">
              <span className="ax-label">Former team</span>
              <ul className="ax-people">
                {past.map((emp) => (
                  <li key={emp.id} className="ax-person is-past">
                    <span className="ax-avatar" aria-hidden="true">{initials(emp.name)}</span>
                    <span className="ax-person-main">
                      <span className="ax-person-name">{emp.name}</span>
                      <span className="ax-sub">{emp.email ?? emp.phone} · access removed</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="ax-detail-side">
          <form
            className="ax-panel"
            onSubmit={(e) => {
              e.preventDefault();
              p.onAdd({ name: name.trim(), email: email.trim().toLowerCase(), role });
              setName("");
              setEmail("");
            }}
          >
            <span className="ax-label">Add someone</span>
            <label className="ax-form-row">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vikram Solanki" autoComplete="off" />
            </label>
            <label className="ax-form-row">
              <span>Google account</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" autoComplete="off" />
            </label>
            <div className="ax-form-row">
              <span>Access</span>
              <div className="ax-choice">
                {(["studio", "admin"] as Role[]).map((r) => (
                  <button key={r} type="button" aria-pressed={role === r} className="ax-choice-opt" onClick={() => setRole(r)}>
                    <span className="ax-choice-title">{ROLE_NAME[r]}</span>
                    <span className="ax-sub">{ROLE_HINT[r]}</span>
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="ax-button ax-button--primary" style={{ width: "100%" }} disabled={p.busy || !name.trim() || !emailOk}>
              Add to team
            </button>
            <p className="ax-note">They sign in with Google using this exact address. Nothing is sent to them; tell them it&apos;s ready.</p>
          </form>
        </aside>
      </div>
    </div>
  );
}
