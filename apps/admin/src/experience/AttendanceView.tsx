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
              <ul className="ax-people">
                {activeStaff.map((emp) => {
                  const rec = byEmployee.get(emp.id);
                  const empOnBreak = rec?.breaks.some((b) => b.endedAt === null) ?? false;
                  return (
                    <li key={emp.id} className="ax-person">
                      <span className={`ax-avatar ax-avatar--${emp.role}`} aria-hidden="true">
                        {emp.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?"}
                      </span>
                      <span className="ax-person-main">
                        <span className="ax-person-name">
                          {emp.name}
                          {empOnBreak ? " · on break" : ""}
                        </span>
                        <span className="ax-sub">
                          {rec
                            ? `${STATUS_NAME[rec.status]} · in ${formatTime(rec.checkInAt)} · out ${formatTime(rec.checkOutAt)} · ${workedLabel(rec.workedMinutes)}`
                            : "Not marked today"}
                        </span>
                      </span>
                      {rec && (
                        <span className={`ax-expiry ${rec.status === "ABSENT" ? "ax-expiry--danger" : rec.status === "HALF_DAY" ? "ax-expiry--warning" : "ax-expiry--ok"}`}>
                          {STATUS_NAME[rec.status]}
                        </span>
                      )}
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
