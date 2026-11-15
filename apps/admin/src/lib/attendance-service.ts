"use client";

import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { AttendanceRecord, AttendanceStatus } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

/** Live attendance for one studio and business date (YYYY-MM-DD, Kolkata). */
export function listenToAttendance(
  tenantId: string,
  studioId: string,
  date: string,
  onData: (records: AttendanceRecord[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.attendance()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("date", "==", date),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as AttendanceRecord)), onError);
}

export async function checkIn(): Promise<{ id: string }> {
  const fn = httpsCallable<Record<string, never>, { id: string }>(functions, "checkInAttendance");
  return (await fn({})).data;
}

export async function checkOut(): Promise<{ id: string }> {
  const fn = httpsCallable<Record<string, never>, { id: string }>(functions, "checkOutAttendance");
  return (await fn({})).data;
}

export async function startBreak(): Promise<{ id: string }> {
  const fn = httpsCallable<Record<string, never>, { id: string }>(functions, "startAttendanceBreak");
  return (await fn({})).data;
}

export async function endBreak(): Promise<{ id: string }> {
  const fn = httpsCallable<Record<string, never>, { id: string }>(functions, "endAttendanceBreak");
  return (await fn({})).data;
}

export async function markAttendance(input: {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}): Promise<{ id: string }> {
  const fn = httpsCallable<typeof input, { id: string }>(functions, "markAttendance");
  return (await fn(input)).data;
}

export async function getEmployeeAttendance(
  employeeId: string,
  month: string,
): Promise<{ records: AttendanceRecord[] }> {
  const fn = httpsCallable<{ employeeId: string; month: string }, { records: AttendanceRecord[] }>(
    functions,
    "getEmployeeAttendance",
  );
  return (await fn({ employeeId, month })).data;
}
