import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import type { AttendanceRecord, Employee } from "@autodeck/core";
import { db, functions } from "../lib/firebase";
import { useAuth } from "./useAuth";
import { dayActions, dayErrorNote, type DayAction } from "../lib/my-day";

const CALL: Record<DayAction, [string, string]> = {
  in: ["checkInAttendance", "Checked in for today."],
  bs: ["startAttendanceBreak", "Break started."],
  be: ["endAttendanceBreak", "Break ended."],
  out: ["checkOutAttendance", "Checked out. See you tomorrow."],
};

const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "-");

/** The signed-in staff member's attendance for today, live, with the same four actions the Account page has. */
export function useMyDay() {
  const authState = useAuth();
  const [me, setMe] = useState<Employee | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [busy, setBusy] = useState<DayAction | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const uid = authState.status === "ready" ? authState.user.uid : null;
  const tenantId = authState.status === "ready" ? authState.claims.tenantId : null;
  useEffect(() => {
    if (!uid || !tenantId) return;
    return onSnapshot(query(collection(db, COLLECTIONS.employees()), where("tenantId", "==", tenantId), where("authUid", "==", uid)), (snap) => { setMe((snap.docs[0]?.data() as Employee | undefined) ?? null); setMeLoaded(true); }, () => { setMe(null); setMeLoaded(true); });
  }, [uid, tenantId]);
  useEffect(() => {
    if (!me || !tenantId) return;
    const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return onSnapshot(doc(db, COLLECTIONS.attendance(), `${tenantId}__${me.id}__${date}`), (snap) => setToday(snap.exists() ? (snap.data() as AttendanceRecord) : null), () => setToday(null));
  }, [me, tenantId]);
  const onBreak = !!today?.breaks?.some((b) => !b.endedAt);
  const state = !today?.checkInAt ? "Not checked in yet" : today.checkOutAt ? `Checked out ${hhmm(today.checkOutAt)} · ${Math.floor(today.workedMinutes / 60)}h ${today.workedMinutes % 60}m worked` : onBreak ? `On break · in since ${hhmm(today.checkInAt)}` : `Working · in since ${hhmm(today.checkInAt)}`;
  async function run(a: DayAction) {
    if (busy) return;
    setBusy(a); setNote(null);
    try { await httpsCallable(functions, CALL[a][0])({}); setNote(CALL[a][1]); }
    catch (e) { setNote(dayErrorNote(e)); }
    finally { setBusy(null); }
  }
  return { ready: !!me, noProfile: meLoaded && !me, state, actions: dayActions(today), busy, note, run };
}
