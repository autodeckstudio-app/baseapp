// Customer-wide listeners Home needs to rank what matters first. Each
// query constrains tenantId + customerId by equality so the Firestore rule
// (ownTenant && customerId == uid) is statically satisfied.
import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import type { ApprovalRequest, Invoice, Membership, ServiceJob } from "@autodeck/core";
import { db } from "./firebase";

function listen<T>(
  col: string,
  tenantId: string,
  uid: string,
  extra: Array<[string, unknown]>,
  onData: (rows: T[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, col),
    where("tenantId", "==", tenantId),
    where("customerId", "==", uid),
    ...extra.map(([f, v]) => where(f, "==", v)),
  );
  return onSnapshot(q, (s) => onData(s.docs.map((d) => d.data() as T)), onError);
}

export const listenToMyPendingApprovals = (tenantId: string, uid: string, onData: (r: ApprovalRequest[]) => void, onError: (e: Error) => void) =>
  listen<ApprovalRequest>(COLLECTIONS.approvals(), tenantId, uid, [["status", "pending"]], onData, onError);

export const listenToMyIssuedInvoices = (tenantId: string, uid: string, onData: (r: Invoice[]) => void, onError: (e: Error) => void) =>
  listen<Invoice>(COLLECTIONS.invoices(), tenantId, uid, [["status", "issued"]], onData, onError);

export const listenToMyJobs = (tenantId: string, uid: string, onData: (r: ServiceJob[]) => void, onError: (e: Error) => void) =>
  listen<ServiceJob>(COLLECTIONS.jobs(), tenantId, uid, [], onData, onError);

export const listenToMyMemberships = (tenantId: string, uid: string, onData: (r: Membership[]) => void, onError: (e: Error) => void) =>
  listen<Membership>(COLLECTIONS.memberships(), tenantId, uid, [], onData, onError);
