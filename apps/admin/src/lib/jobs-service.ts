"use client";

import { collection, query, where, orderBy, limit, doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ServiceJob, Warranty, AuditLog, Inspection } from "@autodeck/core";

const LIST_LIMIT = 300;

/** Live, tenant-wide job feed — newest first. Status/bay/studio/walk-in/customer
 * filters are applied client-side (see bookings-service for the same rationale). */
export function listenToJobs(
  tenantId: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.jobs()),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
    limit(LIST_LIMIT),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as ServiceJob)), onError);
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

// Warranty doc ID == jobId (deterministic, one warranty per job) — direct get, no query.
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
