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
import { FIRST_TENANT_ID } from "@autodeck/core";

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
// constrained by an equality filter it can verify statically. V1 is
// single-tenant, so FIRST_TENANT_ID is the studio user's own tenant.
export function listenToJobsByDate(
  studioId: string,
  date: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.jobs()),
    where("tenantId", "==", FIRST_TENANT_ID),
    where("studioId", "==", studioId),
    where("scheduledDate", "==", date),
  );
  return onSnapshot(
    q,
    (snap) => {
      const jobs = snap.docs
        .map((d) => d.data() as ServiceJob)
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
