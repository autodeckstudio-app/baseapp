import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ApprovalRequest, Service } from "@autodeck/core";

type CreateApprovalInput = { jobId: string; serviceId: string; quantity?: number; reason: string };
type CreateApprovalOutput = { approvalId: string };

type CancelApprovalInput = { approvalId: string };
type CancelApprovalOutput = { approvalId: string };

export async function createApproval(input: CreateApprovalInput): Promise<CreateApprovalOutput> {
  const fn = httpsCallable<CreateApprovalInput, CreateApprovalOutput>(functions, "createApproval");
  const result = await fn(input);
  return result.data;
}

export async function cancelApproval(approvalId: string): Promise<CancelApprovalOutput> {
  const fn = httpsCallable<CancelApprovalInput, CancelApprovalOutput>(functions, "cancelApproval");
  const result = await fn({ approvalId });
  return result.data;
}

// Filters by jobId + tenantId — the /approvals rule requires
// ownTenant(resource.data) unconditionally, so the list query needs
// tenantId constrained by an equality filter it can verify statically.
export function listenToApprovalsForJob(
  jobId: string,
  tenantId: string,
  onData: (approvals: ApprovalRequest[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.approvals()),
    where("jobId", "==", jobId),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as ApprovalRequest)),
    onError,
  );
}

type GetServiceCatalogueOutput = { services: Service[] };

export async function getActiveServices(): Promise<Service[]> {
  const fn = httpsCallable<Record<string, never>, GetServiceCatalogueOutput>(functions, "getServiceCatalogue");
  const result = await fn({});
  return result.data.services.filter((s) => s.active);
}
