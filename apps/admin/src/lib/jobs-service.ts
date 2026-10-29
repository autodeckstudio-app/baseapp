"use client";

import { collection, query, where, orderBy, limit, doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ServiceJob, Warranty, AuditLog, Inspection } from "@autodeck/core";

import { OPEN_JOB_STATUSES, mergeJobFeeds } from "./jobs-merge";

const LIST_LIMIT = 300;

type Sub = { onData: (jobs: ServiceJob[]) => void; onError: (err: Error) => void; onBounded: (note: string | null) => void };
type Hub = { subs: Set<Sub>; stop: () => void; data: ServiceJob[] | null; error: Error | null; note: string | null };
const hubs = new Map<string, Hub>();

function startHub(tenantId: string, hub: Hub): void {
  const jobsCol = collection(db, COLLECTIONS.jobs());
  let recent: ServiceJob[] | null = null;
  const open: (ServiceJob[] | null)[] = OPEN_JOB_STATUSES.map(() => null);
  const failed = new Set<string>();
  const emit = () => {
    // Wait for every feed before showing anything, so the board never flashes a partial list.
    if (recent === null || open.some((o) => o === null)) return;
    hub.data = mergeJobFeeds(recent, open as ServiceJob[][]);
    hub.note = failed.size
      ? `Showing only the newest ${LIST_LIMIT} jobs: reading open jobs failed (${[...failed].join(", ")}). Older open jobs may be missing.`
      : null;
    hub.subs.forEach((s) => { s.onData(hub.data!); s.onBounded(hub.note); });
  };
  const toList = (snap: { docs: { data: () => unknown }[] }) => snap.docs.map((d) => d.data() as ServiceJob);
  const unsubs: Unsubscribe[] = [
    onSnapshot(query(jobsCol, where("tenantId", "==", tenantId), orderBy("createdAt", "desc"), limit(LIST_LIMIT)),
      (snap) => { recent = toList(snap); hub.error = null; emit(); },
      (err) => { hub.error = err; hub.data = null; recent = null; hub.subs.forEach((s) => s.onError(err)); }),
    // Equality-only queries (no orderBy). Whether the project's Firestore serves these without a new
    // composite index is NOT proven; a failure is shown to the user as a bounded-list notice.
    ...OPEN_JOB_STATUSES.map((status, i) =>
      onSnapshot(query(jobsCol, where("tenantId", "==", tenantId), where("status", "==", status)),
        (snap) => { open[i] = toList(snap); failed.delete(status); emit(); },
        () => { open[i] = []; failed.add(status); emit(); })),  // a dead feed is cleared, never kept as if current
  ];
  hub.stop = () => unsubs.forEach((u) => u());
}

/** Live, tenant-wide job feed - newest 300 plus every open job. One set of listeners is shared by all
 * Admin screens (ref-counted), so opening more pages does not add reads. onBounded(note) is called with
 * a message when the open-job reads fail (list limited to newest 300) and with null when it is complete. */
export function listenToJobs(
  tenantId: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
  onBounded: (note: string | null) => void = () => undefined,
): Unsubscribe {
  let hub = hubs.get(tenantId);
  if (!hub) {
    hub = { subs: new Set(), stop: () => undefined, data: null, error: null, note: null };
    hubs.set(tenantId, hub);
    startHub(tenantId, hub);
  }
  const sub: Sub = { onData, onError, onBounded };
  hub.subs.add(sub);
  if (hub.data) { onData(hub.data); onBounded(hub.note); }
  if (hub.error) onError(hub.error);
  const h = hub;
  return () => {
    h.subs.delete(sub);
    if (h.subs.size === 0) { h.stop(); if (hubs.get(tenantId) === h) hubs.delete(tenantId); }
  };
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
