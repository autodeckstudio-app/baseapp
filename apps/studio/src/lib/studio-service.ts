import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ServiceJob, StudioConfig, Service } from "@autodeck/core";
import { MAX_SERVICE_SPAN_DAYS } from "@autodeck/core";

// Returns "YYYY-MM-DD" for N days after/before the given local date string.
// Mirrors functions/src/lib/schedule.ts's addDays (kept separate — this is
// client code, not a shared package).
function addDaysLocal(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type GetStudioJobsInput = { studioId: string; date?: string };
type GetStudioJobsOutput = { jobs: ServiceJob[]; date: string };

type AdvanceJobStatusInput = { jobId: string; notes?: string };
type AdvanceJobStatusOutput = { jobId: string; previousStatus: string; newStatus: string };

type CreateWalkinJobInput = {
  serviceId: string;
  vehicleId: string;
  vehicleCategory: string;
  bayId: string;
  customerId: string;
  studioId: string;
  notes?: string;
};
type CreateWalkinJobOutput = { job: ServiceJob };

type AssignBayInput = { jobId: string; bayId: string; reason?: string };
type AssignBayOutput = { jobId: string; previousBayId: string; newBayId: string };

export async function getStudioJobs(
  studioId: string,
  date?: string,
): Promise<GetStudioJobsOutput> {
  const fn = httpsCallable<GetStudioJobsInput, GetStudioJobsOutput>(
    functions,
    "getStudioJobs",
  );
  const input: GetStudioJobsInput = date !== undefined ? { studioId, date } : { studioId };
  const result = await fn(input);
  return result.data;
}

export async function advanceJobStatus(
  jobId: string,
  notes?: string,
): Promise<AdvanceJobStatusOutput> {
  const fn = httpsCallable<AdvanceJobStatusInput, AdvanceJobStatusOutput>(
    functions,
    "advanceJobStatus",
  );
  const input: AdvanceJobStatusInput = notes !== undefined ? { jobId, notes } : { jobId };
  const result = await fn(input);
  return result.data;
}

export async function createWalkinJob(
  input: CreateWalkinJobInput,
): Promise<CreateWalkinJobOutput> {
  const fn = httpsCallable<CreateWalkinJobInput, CreateWalkinJobOutput>(
    functions,
    "createWalkinJob",
  );
  const result = await fn(input);
  return result.data;
}

export async function assignBay(input: AssignBayInput): Promise<AssignBayOutput> {
  const fn = httpsCallable<AssignBayInput, AssignBayOutput>(functions, "assignBay");
  const result = await fn(input);
  return result.data;
}

export async function getStudioConfig(studioId: string): Promise<StudioConfig | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.studioConfig(), studioId));
  if (!snap.exists()) return null;
  return snap.data() as StudioConfig;
}

// Filters by tenantId as well: the /jobs rule requires
// ownTenant(resource.data) unconditionally (regardless of role), so
// Firestore rejects the list query outright unless tenantId is also
// constrained by an equality filter it can verify statically — always the
// calling studio user's own claims.tenantId (never a hardcoded constant).
// Jobs visible "on" `date` are those SCHEDULED to start on or before it and
// still running through it (estimatedEndDate >= date) — a same-day exact
// match alone would silently drop an in-progress multi-day job (e.g. a PPF
// job that started Monday, still occupying a bay on Wednesday) from Today's
// Jobs / Calendar / Bay Board on any day after its start (Phase 5 —
// multi-day booking). The query is widened to a bounded range and filtered
// in-memory; reuses the existing (tenantId, studioId, scheduledDate,
// scheduledAt) composite index — a range filter on the last equality field
// needs no new index.
export function listenToJobsByDate(
  tenantId: string,
  studioId: string,
  date: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const rangeStart = addDaysLocal(date, -MAX_SERVICE_SPAN_DAYS);
  const q = query(
    collection(db, COLLECTIONS.jobs()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("scheduledDate", ">=", rangeStart),
    where("scheduledDate", "<=", date),
  );
  return onSnapshot(
    q,
    (snap) => {
      const jobs = snap.docs
        .map((d) => d.data() as ServiceJob)
        .filter((j) => j.estimatedEndDate >= date)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      onData(jobs);
    },
    onError,
  );
}

export async function getServiceById(serviceId: string): Promise<Service | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.services(), serviceId));
  if (!snap.exists()) return null;
  return snap.data() as Service;
}
