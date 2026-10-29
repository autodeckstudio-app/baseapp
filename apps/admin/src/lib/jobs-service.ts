"use client";

import { collection, query, where, orderBy, limit, doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ServiceJob, Warranty, AuditLog, Inspection } from "@autodeck/core";

import { OPEN_JOB_STATUSES, mergeJobFeeds } from "./jobs-merge";

const LIST_LIMIT = 300;

/** Live, tenant-wide job feed - newest first. Status/bay/studio/walk-in/customer
 * filters are applied client-side (see bookings-service for the same rationale). */
export function listenToJobs(
  tenantId: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
  /** Called when the open-job reads fail but the newest-300 feed works: the list is then bounded to the newest 300. */
  onBounded: (note: string) => void = (n) => console.warn(n),
): Unsubscribe {
  const jobsCol = collection(db, COLLECTIONS.jobs());
  let recent: ServiceJob[] | null = null;
  const open: (ServiceJob[] | null)[] = OPEN_JOB_STATUSES.map(() => null);
  const emit = () => {
    // Wait for every feed before showing anything, so the board never flashes a partial list.
    if (recent === null || open.some((o) => o === null)) return;
    onData(mergeJobFeeds(recent, open as ServiceJob[][]));
  };
  const toList = (snap: { docs: { data: () => unknown }[] }) => snap.docs.map((d) => d.data() as ServiceJob);
  const unsubs: Unsubscribe[] = [
    onSnapshot(query(jobsCol, where("tenantId", "==", tenantId), orderBy("createdAt", "desc"), limit(LIST_LIMIT)),
      (snap) => { recent = toList(snap); emit(); }, onError),
    // Equality-only queries (no orderBy): Firestore serves these from single-field indexes, so no new
    // composite index is needed. If this ever fails, the error is surfaced through onError, not hidden.
    ...OPEN_JOB_STATUSES.map((status, i) =>
      onSnapshot(query(jobsCol, where("tenantId", "==", tenantId), where("status", "==", status)),
        (snap) => { open[i] = toList(snap); emit(); },
        (err) => { open[i] = open[i] ?? []; onBounded(`Open-job read for ${status} failed (${err.message}); showing the newest ${LIST_LIMIT} jobs only.`); emit(); })),
  ];
  return () => unsubs.forEach((u) => u());
}

export function listenToJob(
  jobId: string,
  onData: (job: ServiceJob | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.jobs(), jobId),
    (snap) => onData(snap.exists() ? (snap.data() as ServiceJob) : null),
    onError,
  );
}

// Warranty doc ID == jobId (deterministic, one warranty per job) - direct get, no query.
export async function getWarrantyForJob(jobId: string): Promise<Warranty | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.warranties(), jobId));
  return snap.exists() ? (snap.data() as Warranty) : null;
}

// Inspection doc ID == jobId (same deterministic pattern as Warranty).
export function listenToInspectionForJob(
  jobId: string,
  onData: (inspection: Inspection | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.inspections(), jobId),
    (snap) => onData(snap.exists() ? (snap.data() as Inspection) : null),
    onError,
  );
}

export function listenToAuditForEntity(
  tenantId: string,
  entityType: string,
  entityId: string,
  onData: (entries: AuditLog[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.auditLog()),
    where("tenantId", "==", tenantId),
    where("entityType", "==", entityType),
    where("entityId", "==", entityId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as AuditLog)), onError);
}
