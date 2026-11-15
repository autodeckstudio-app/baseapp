// PROVISIONAL: wired to the backend contract relayed on 26 Oct (requestAdminApproval). Not deployed; never run against a real function.
// An admin approval records a decision only. It does not refund, discount or change any price.
import { httpsCallable } from "firebase/functions";
import { collection, query, where, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import type { AdminRequestDoc } from "./admin-approval-rules";

import { checkAdminRequest, type AdminRequestInput } from "./admin-approval-rules";

export async function requestAdminApproval(i: AdminRequestInput): Promise<string> {
  const err = checkAdminRequest(i);
  if (err) throw new Error(err);
  const fn = httpsCallable<AdminRequestInput, { requestId: string }>(functions, "requestAdminApproval");
  const { data } = await fn({ ...i, reason: i.reason.trim() });
  return data.requestId;
}

/** Staff read their own studio's requests. Query is tenantId + studioId equality only (no orderBy); sorting is client-side. Provisional collection name from the relayed contract. */
export function listenToAdminRequests(tenantId: string, studioId: string, onData: (r: AdminRequestDoc[]) => void, onError: (e: Error) => void): Unsubscribe {
  const q = query(collection(db, "adminApprovalRequests"), where("tenantId", "==", tenantId), where("studioId", "==", studioId));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as AdminRequestDoc), id: d.id }))), onError);
}
