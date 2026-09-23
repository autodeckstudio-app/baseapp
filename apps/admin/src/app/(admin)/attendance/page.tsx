"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { AttendanceRecord, AttendanceStatus, Employee } from "@autodeck/core";
import {
  listenToAttendance,
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  markAttendance,
} from "../../../lib/attendance-service";
import { listStaff } from "../../../lib/staff-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { AttendanceView } from "../../../experience/AttendanceView";

function kolkataToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default function AttendancePage() {
  const { user, claims } = useAdminAuth();
  const [staff, setStaff] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const studioId = claims?.studioId ?? FIRST_STUDIO_ID;
  const today = kolkataToday();

  useEffect(() => {
    if (!claims) return;
    listStaff(claims.tenantId)
      .then(setStaff)
      .catch(() => setError("Couldn't load the team."));
  }, [claims]);

  useEffect(() => {
    if (!claims) return;
    const unsub = listenToAttendance(
      claims.tenantId,
      studioId,
      today,
      (recs) => { setRecords(recs); setLoading(false); },
      () => { setError("Couldn't load attendance."); setLoading(false); },
    );
    return unsub;
  }, [claims, studioId, today]);

  const me = useMemo(() => staff.find((s) => s.authUid === user?.uid) ?? null, [staff, user]);
  const myRecord = useMemo(() => (me ? records.find((r) => r.employeeId === me.id) ?? null : null), [records, me]);

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(ok);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fail);
    } finally {
      setBusy(false);
    }
  }

  const onMark = useCallback(
    (employeeId: string, status: AttendanceStatus, notes: string) =>
      void run(
        () => markAttendance({ employeeId, date: today, status, ...(notes ? { notes } : {}) }),
        "Marked.",
        "Couldn't save the mark.",
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today],
  );

  return (
    <AttendanceView
      date={today}
      staff={staff}
      records={records}
      me={me}
      myRecord={myRecord}
      isAdmin={claims?.role === "admin" || claims?.role === "superadmin"}
      loading={loading}
      busy={busy}
      error={error}
      message={message}
      onCheckIn={() => void run(checkIn, "Checked in. Have a good shift.", "Couldn't check in.")}
      onCheckOut={() => void run(checkOut, "Checked out.", "Couldn't check out.")}
      onStartBreak={() => void run(startBreak, "Break started.", "Couldn't start the break.")}
      onEndBreak={() => void run(endBreak, "Break ended.", "Couldn't end the break.")}
      onMark={onMark}
    />
  );
}
