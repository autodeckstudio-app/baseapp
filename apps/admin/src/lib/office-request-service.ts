"use client";
// PROVISIONAL: wired to the backend contract relayed on 26 Oct. Not deployed. Collection adminApprovalRequests; admin reads by tenantId only.
import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { checkDecision, sortNewestFirst, type OfficeRequestRow } from "./office-request-rules";

export function listenToOfficeRequests(tenantId: string, onData: (rows: OfficeRequestRow[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "adminApprovalRequests"), where("tenantId", "==", tenantId)),
    (snap) => onData(sortNewestFirst(snap.docs.map((d) => ({ ...(d.data() as OfficeRequestRow), id: d.id })))),
    onError,
  );
}

export async function respondToOfficeRequest(requestId: string, decision: "approved" | "rejected", note: string): Promise<void> {
  const bad = checkDecision(decision, note);
  if (bad) throw new Error(bad);
  await httpsCallable(functions, "respondToAdminApproval")({ requestId, decision, ...(note.trim() ? { note: note.trim() } : {}) });
}
