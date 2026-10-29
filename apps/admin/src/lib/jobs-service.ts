"use client";

import { collection, query, where, orderBy, limit, doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ServiceJob, Warranty, AuditLog, Inspection } from "@autodeck/core";

import { OPEN_JOB_STATUSES, mergeJobFeeds } from "./jobs-merge";

const LIST_LIMIT = 300;

type Sub = { onData: (jobs: ServiceJob[]) => void; onError: (err: Error) => void; onBounded: (note: string | null) => void };
type Hub = { key: string; subs: Set<Sub>; stop: () => void; data: ServiceJob[] | null; error: Error | null; note: string | null; dead: boolean };
const hubs = new Map<string, Hub>();

// A callback that throws must not stop the other screens from being updated.
const safe = (fn: () => void) => { try { fn(); } catch (e) { console.error("jobs feed subscriber failed", e); } };

function startHub(tenantId: string, hub: Hub): void {
  const jobsCol = collection(db, COLLECTIONS.jobs());
  let recent: ServiceJob[] | null = null;
  const open: (ServiceJob[] | null)[] = OPEN_JOB_STATUSES.map(() => null);
  const failed = new Set<string>();
  const emit = () => {
    if (hub.dead) return;
    // Wait for every feed before showing anything, so the board never flashes a partial list.
    if (recent === null || open.some((o) => o === null)) return;
    hub.data = mergeJobFeeds(recent, open as ServiceJob[][]);
    hub.note = failed.size
      ? `Could not read all open jobs (${[...failed].join(", ")}). Jobs in those statuses that are older than the newest ${LIST_LIMIT} may be missing here.`
      : null;
    hub.subs.forEach((s) => safe(() => { s.onData(hub.data!.slice()); s.onBounded(hub.note); }));
  };
  const toList = (snap: { docs: { data: () => unknown }[] }) => snap.docs.map((d) => d.data() as ServiceJob);
  const unsubs: Unsubscribe[] = [
    onSnapshot(query(jobsCol, where("tenantId", "==", tenantId), orderBy("createdAt", "desc"), limit(LIST_LIMIT)),
      (snap) => { recent = toList(snap); emit(); },
      (err) => {
        // The main feed is finished once it errors. Tell everyone, close the rest and forget this hub, so the
        // next listenToJobs starts a fresh one. No automatic retry (a permission error will not fix itself).
        hub.dead = true; hub.stop();
        if (hubs.get(hub.key) === hub) hubs.delete(hub.key);
        const subs = [...hub.subs]; hub.subs.clear();
        subs.forEach((s) => safe(() => s.onError(err)));
      }),
    // Equality-only queries (no orderBy). Whether the project's Firestore serves these without a new
    // composite index is NOT proven; a failure is shown to the user as a notice.
    ...OPEN_JOB_STATUSES.map((status, i) =>
      onSnapshot(query(jobsCol, where("tenantId", "==", tenantId), where("status", "==", status)),
        (snap) => { open[i] = toList(snap); failed.delete(status); emit(); },
        () => { open[i] = []; failed.add(status); emit(); })),  // a dead feed is cleared, never kept as if current
  ];
  hub.stop = () => unsubs.forEach((u) => u());
}

/** Live, tenant-wide job feed - newest 300 plus every open job. One set of listeners is shared by the Admin
 * screens of the same signed-in user and tenant (ref-counted). onBounded(note) gets a message when some open-job
 * reads fail and null when the list is complete. */
export function listenToJobs(
  tenantId: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
  onBounded: (note: string | null) => void = () => undefined,
): Unsubscribe {
  const key = `${auth.currentUser?.uid ?? "anon"}:${tenantId}`;
  let hub = hubs.get(key);
  if (!hub) {
    hub = { key, subs: new Set(), stop: () => undefined, data: null, error: null, note: null, dead: false };
    hubs.set(key, hub);
    startHub(tenantId, hub);
  }
  const sub: Sub = { onData, onError, onBounded };
  hub.subs.add(sub);
  if (hub.data) { const d = hub.data.slice(), n = hub.note; safe(() => { onData(d); onBounded(n); }); }
  const h = hub;
  return () => {
    if (!h.subs.delete(sub)) return;
    if (h.subs.size === 0) { h.dead = true; h.stop(); if (hubs.get(key) === h) hubs.delete(key); }
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
