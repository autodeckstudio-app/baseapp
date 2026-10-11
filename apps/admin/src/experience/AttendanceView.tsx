"use client";

// Attendance: today's floor roster with check-in state. Staff check
// themselves in/out and log breaks; Office can correct a day (mark).
import { useState } from "react";
import type { AttendanceRecord, AttendanceStatus, Employee } from "@autodeck/core";
import { PageHead } from "./Office";
import { formatTime } from "../lib/format";

const STATUS_NAME: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  HALF_DAY: "Half day",
  ABSENT: "Absent",
  ON_LEAVE: "On leave",
};

function workedLabel(minutes: number): string {
  if (minutes <= 0) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function AttendanceView(p: {
  date: string;
  staff: Employee[];
  records: AttendanceRecord[];
  me: Employee | null;
  myRecord: AttendanceRecord | null;
  isAdmin: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onMark: (employeeId: string, status: AttendanceStatus, notes: string) => void;
}) {
  const [markFor, setMarkFor] = useState<string>("");
  const [markStatus, setMarkStatus] = useState<AttendanceStatus>("PRESENT");
  const [markNotes, setMarkNotes] = useState("");

  const byEmployee = new Map(p.records.map((r) => [r.employeeId, r]));
  const present = p.records.filter((r) => r.status === "PRESENT" || r.status === "HALF_DAY").length;
  const onBreak = p.records.some((r) => r.breaks.some((b) => b.endedAt === null));
  const myOnBreak = p.myRecord?.breaks.some((b) => b.endedAt === null) ?? false;
  const activeStaff = p.staff.filter((s) => !s.terminatedAt);

  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Studio"
        title="Attendance"
        kpis={[
          { value: present, label: "Present today" },
          { value: activeStaff.length - present, label: "Not in", tone: activeStaff.length - present > 0 ? "accent" : undefined },
          { value: p.records.length, label: "Marked", tone: "premium" },
        ]}
      />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            <span className="ax-label">Today · {p.date}</span>
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ax-skel ax-skel--row" />)
            ) : activeStaff.length === 0 ? (
              <p className="ax-note">No one on the roster yet. Add people from Office → Team.</p>
            ) : (
              <ul className="ax-roster">
                {activeStaff.map((emp) => {
                  const rec = byEmployee.get(emp.id);
                  const empOnBreak = rec?.breaks.some((b) => b.endedAt === null) ?? false;
                  const tone = !rec ? "idle" : rec.status === "ABSENT" ? "danger" : rec.status === "HALF_DAY" || rec.status === "ON_LEAVE" ? "warning" : "ok";
                  return (
                    <li key={emp.id} className="ax-roster-row">
                      <div className="ax-roster-head">
                        <span className={`ax-roster-dot ax-roster-dot--${tone}`} aria-hidden="true" />
                        <span className="ax-roster-name">{emp.name}</span>
                        <span className="ax-roster-role">{emp.role}</span>
                        <span className={`ax-roster-pill ax-roster-pill--${tone}`}>
                          {empOnBreak ? "On break" : rec ? STATUS_NAME[rec.status] : "Not marked"}
                        </span>
                      </div>
                      <dl className="ax-roster-stats">
                        <div><dt>In</dt><dd>{rec ? formatTime(rec.checkInAt) : "-"}</dd></div>
                        <div><dt>Out</dt><dd>{rec ? formatTime(rec.checkOutAt) : "-"}</dd></div>
                        <div><dt>Worked</dt><dd>{rec ? workedLabel(rec.workedMinutes) : "-"}</dd></div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="ax-detail-side">
          {p.me && (
            <section className="ax-panel">
              <span className="ax-label">Your day</span>
              {p.myRecord ? (
                <p className="ax-note">
                  {STATUS_NAME[p.myRecord.status]} · in {formatTime(p.myRecord.checkInAt)} · out{" "}
                  {formatTime(p.myRecord.checkOutAt)} · {workedLabel(p.myRecord.workedMinutes)}
                </p>
              ) : (
                <p className="ax-note">You haven't checked in today.</p>
              )}
              <div className="ax-panel-actions">
                {!p.myRecord?.checkInAt && (
                  <button type="button" className="ax-button ax-button--primary" disabled={p.busy} onClick={p.onCheckIn}>
                    Check in
                  </button>
                )}
                {p.myRecord?.checkInAt && !p.myRecord.checkOutAt && !myOnBreak && (
                  <>
                    <button type="button" className="ax-button" disabled={p.busy} onClick={p.onStartBreak}>
                      Start break
                    </button>
                    <button type="button" className="ax-button ax-button--primary" disabled={p.busy} onClick={p.onCheckOut}>
                      Check out
                    </button>
                  </>
                )}
                {myOnBreak && (
                  <button type="button" className="ax-button ax-button--primary" disabled={p.busy} onClick={p.onEndBreak}>
                    End break
                  </button>
                )}
              </div>
            </section>
          )}

          {p.isAdmin && (
            <section className="ax-panel">
              <span className="ax-label">Mark someone (Office)</span>
              <div className="ax-form-section">
                <select value={markFor} onChange={(e) => setMarkFor(e.target.value)} aria-label="Person" disabled={p.busy}>
                  <option value="">Choose person…</option>
                  {activeStaff.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                <div className="ax-form-pair">
                  <select value={markStatus} onChange={(e) => setMarkStatus(e.target.value as AttendanceStatus)} aria-label="Status" disabled={p.busy}>
                    {(Object.keys(STATUS_NAME) as AttendanceStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_NAME[s]}</option>
                    ))}
                  </select>
                  <input
                    value={markNotes}
                    onChange={(e) => setMarkNotes(e.target.value)}
                    placeholder="Note (optional)"
                    aria-label="Note"
                    disabled={p.busy}
                  />
                </div>
                <button
                  type="button"
                  className="ax-button ax-button--primary"
                  disabled={p.busy || !markFor}
                  onClick={() => { p.onMark(markFor, markStatus, markNotes.trim()); setMarkNotes(""); }}
                >
                  Save mark
                </button>
                <p className="ax-note">Marking never changes recorded check-in times.</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
