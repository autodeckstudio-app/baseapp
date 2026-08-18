import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ApprovalRequest } from "@autodeck/core";

// Filters by jobId + tenantId + customerId — the /approvals rule requires
// ownTenant(resource.data) unconditionally and customerId==uid for the
// customer branch, so the list query needs both constrained by equality
// filters it can verify statically.
export function listenToApprovalsForJob(
  jobId: string,
  tenantId: string,
  customerId: string,
  onData: (approvals: ApprovalRequest[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.approvals()),
    where("jobId", "==", jobId),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as ApprovalRequest)),
    onError,
  );
}

export function listenToApproval(
  approvalId: string,
  onData: (approval: ApprovalRequest | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.approvals(), approvalId),
    (snap) => onData(snap.exists() ? (snap.data() as ApprovalRequest) : null),
    onError,
  );
}

type RespondToApprovalInput = { approvalId: string; decision: "approved" | "rejected" };
type RespondToApprovalOutput = { approvalId: string; decision: "approved" | "rejected" };

export async function respondToApproval(
  approvalId: string,
  decision: "approved" | "rejected",
): Promise<RespondToApprovalOutput> {
  const fn = httpsCallable<RespondToApprovalInput, RespondToApprovalOutput>(functions, "respondToApproval");
  const result = await fn({ approvalId, decision });
  return result.data;
}
