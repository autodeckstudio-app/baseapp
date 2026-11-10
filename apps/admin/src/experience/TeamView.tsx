"use client";

// Team: who can sign in and what they see. Studio staff get the floor app;
// Office staff get everything. Access is by Google account on this roster.
import { useState } from "react";
import type { Employee, StaffAccessRequest } from "@autodeck/core";
import { StaffDocumentReview } from "./StaffDocumentReview";
import { PageHead } from "./Office";

type Role = "studio" | "admin";
const ROLE_NAME: Record<Role, string> = { studio: "Studio", admin: "Admin" };
const ROLE_HINT: Record<Role, string> = { studio: "Bookings • jobs", admin: "Money • team • settings" };

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export function TeamView(p: {
  staff: Employee[];
  loading: boolean;
  error: string | null;
  message: string | null;
  busy: boolean;
  onAdd: (input: { name: string; email: string; phone?: string; role: Role }) => void;
  onRole: (emp: Employee, role: Role) => void;
  onRemove: (emp: Employee) => void;
  requests?: StaffAccessRequest[];
  onDecide?: (req: StaffAccessRequest, decision: "approve" | "reject", role: Role) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("studio");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const current = p.staff.filter((s) => !s.terminatedAt);
  const past = p.staff.filter((s) => s.terminatedAt);
  const waiting = current.filter((s) => !s.authUid).length;
  const pendingReqs = (p.requests ?? []).filter((r) => r.status === "pending");
  const [reqRole, setReqRole] = useState<Role>("studio");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Admin"
        title="Team"
        kpis={[
          { value: current.filter((s) => s.role === "studio").length, label: "Studio" },
          { value: current.filter((s) => s.role === "admin").length, label: "Admin", tone: "premium" },
          { value: waiting, label: "Not signed in yet", tone: waiting ? "accent" : undefined },
          { value: pendingReqs.length, label: "Requests", tone: pendingReqs.length ? "accent" : undefined },
        ]}
      />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          {pendingReqs.length > 0 && (
            <section className="ax-panel">
              <span className="ax-label">Waiting for your approval</span>
              <ul className="ax-people">
                {pendingReqs.map((r) => (
                  <li key={r.uid} className="ax-person">
                    <span className="ax-avatar" aria-hidden="true">{initials(r.name)}</span>
                    <span className="ax-person-main">
                      <span className="ax-person-name">{r.name}</span>
                      <span className="ax-sub">{r.email}{r.phone ? ` · ${r.phone}` : ""}</span>
                    </span>
                    <select value={reqRole} onChange={(e) => setReqRole(e.target.value as Role)} aria-label={`Access for ${r.name}`} disabled={p.busy}>
                      <option value="studio">Studio</option>
                      <option value="admin">Admin</option>
                    </select>
                    <span className="ax-row-actions">
                      <button type="button" className="ax-button ax-button--primary" disabled={p.busy} onClick={() => p.onDecide?.(r, "approve", reqRole)}>Approve</button>
                      <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onDecide?.(r, "reject", reqRole)}>Decline</button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="ax-panel">
            <span className="ax-label">People with access</span>
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ax-skel ax-skel--row" />)
            ) : current.length === 0 ? (
              <p className="ax-note">No one on the team yet. Add the first person on the right.</p>
            ) : (
              <ul className="ax-people">
                {([...current.filter(e=>e.role!=="admin"),...current.filter(e=>e.role==="admin")]).map((emp,i,ordered) => (
                  <li key={emp.id} className="ax-person" style={{flexWrap:"wrap"}}>
                    {i===0||(ordered[i-1]?.role==="admin")!==(emp.role==="admin")?<span className="ax-label" style={{width:"100%",gridColumn:"1 / -1",flexBasis:"100%",paddingTop:i===0?0:12}}>{emp.role==="admin"?"Admin":"Staff"}</span>:null}
                    <span className={`ax-avatar ax-avatar--${emp.role}`} aria-hidden="true">{initials(emp.name)}</span>
                    <span className="ax-person-main">
                      <span className="ax-person-name">{emp.name}</span>
                      <span className="ax-sub">{emp.email ?? emp.phone}{emp.authUid ? "" : " · hasn't signed in yet"}</span>
                    </span>
                    <select value={emp.role} onChange={(e) => p.onRole(emp, e.target.value as Role)} aria-label={`Access for ${emp.name}`} disabled={p.busy}>
                      <option value="studio">Studio</option>
                      <option value="admin">Admin</option>
                    </select>
                    {confirmId === emp.id ? (
                      <span className="ax-row-actions">
                        <button type="button" className="ax-button ax-button--danger" disabled={p.busy} onClick={() => { p.onRemove(emp); setConfirmId(null); }}>Remove access</button>
                        <button type="button" className="ax-button" onClick={() => setConfirmId(null)}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" className="ax-button" onClick={() => setConfirmId(emp.id)}>Remove</button>
                    )}
                    {emp.authUid?<StaffDocumentReview employeeId={emp.id} revisionKey={emp.documentReview?`${emp.documentReview.revision}:${emp.documentReview.status}`:undefined}/>:null}
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
              // Contact number is optional: the Google account alone grants sign-in
              // (basket item 1: name/email/contact; the Google account alone grants sign-in.)
              p.onAdd({ name: name.trim(), email: email.trim().toLowerCase(), ...(phone.trim() === "" ? {} : { phone: phone.trim() }), role });
              setName("");
              setEmail("");
              setPhone("");
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
            <label className="ax-form-row">
              <span>Contact number (optional)</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" autoComplete="off" />
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
            <div className="ax-note" style={{display:"grid",gap:6}}><span>Sign-in: exact Google email.</span><span>Invite: nothing sent automatically.</span><span>Next: tell them access is ready.</span></div>
          </form>
        </aside>
      </div>
    </div>
  );
}
