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
    <div className="ad-page">
      <PageHead
        eyebrow="Office"
        title="Team"
        kpis={[
          { value: current.filter((s) => s.role === "studio").length, label: "Studio" },
          { value: current.filter((s) => s.role === "admin").length, label: "Office", tone: "premium" },
          { value: waiting, label: "Not signed in yet", tone: waiting ? "accent" : undefined },
        ]}
      />
      {p.error && <p className="ad-status-msg ad-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ad-status-msg">{p.message}</p>}

      <div className="ad-detail">
        <div className="ad-detail-main">
          <section className="ad-panel">
            <span className="ad-label">People with access</span>
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ad-skel ad-skel--row" />)
            ) : current.length === 0 ? (
              <p className="ad-note">No one on the team yet. Add the first person on the right.</p>
            ) : (
              <ul className="ad-people">
                {current.map((emp) => (
                  <li key={emp.id} className="ad-person">
                    <span className={`ad-avatar ad-avatar--${emp.role}`} aria-hidden="true">{initials(emp.name)}</span>
                    <span className="ad-person-main">
                      <span className="ad-person-name">{emp.name}</span>
                      <span className="ad-sub">{emp.email ?? emp.phone}{emp.authUid ? "" : " · hasn't signed in yet"}</span>
                    </span>
                    <select value={emp.role} onChange={(e) => p.onRole(emp, e.target.value as Role)} aria-label={`Access for ${emp.name}`} disabled={p.busy}>
                      <option value="studio">Studio</option>
                      <option value="admin">Office</option>
                    </select>
                    {confirmId === emp.id ? (
                      <span className="ad-row-actions">
                        <button type="button" className="ad-button ad-button--danger" disabled={p.busy} onClick={() => { p.onRemove(emp); setConfirmId(null); }}>Remove access</button>
                        <button type="button" className="ad-button" onClick={() => setConfirmId(null)}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" className="ad-button" onClick={() => setConfirmId(emp.id)}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section className="ad-panel">
              <span className="ad-label">Former team</span>
              <ul className="ad-people">
                {past.map((emp) => (
                  <li key={emp.id} className="ad-person is-past">
                    <span className="ad-avatar" aria-hidden="true">{initials(emp.name)}</span>
                    <span className="ad-person-main">
                      <span className="ad-person-name">{emp.name}</span>
                      <span className="ad-sub">{emp.email ?? emp.phone} · access removed</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="ad-detail-side">
          <form
            className="ad-panel"
            onSubmit={(e) => {
              e.preventDefault();
              p.onAdd({ name: name.trim(), email: email.trim().toLowerCase(), role });
              setName("");
              setEmail("");
            }}
          >
            <span className="ad-label">Add someone</span>
            <label className="ad-form-row">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vikram Solanki" autoComplete="off" />
            </label>
            <label className="ad-form-row">
              <span>Google account</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" autoComplete="off" />
            </label>
            <div className="ad-form-row">
              <span>Access</span>
              <div className="ad-choice">
                {(["studio", "admin"] as Role[]).map((r) => (
                  <button key={r} type="button" aria-pressed={role === r} className="ad-choice-opt" onClick={() => setRole(r)}>
                    <span className="ad-choice-title">{ROLE_NAME[r]}</span>
                    <span className="ad-sub">{ROLE_HINT[r]}</span>
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="ad-button ad-button--primary" style={{ width: "100%" }} disabled={p.busy || !name.trim() || !emailOk}>
              Add to team
            </button>
            <p className="ad-note">They sign in with Google using this exact address. Nothing is sent to them; tell them it&apos;s ready.</p>
          </form>
        </aside>
      </div>
    </div>
  );
}
