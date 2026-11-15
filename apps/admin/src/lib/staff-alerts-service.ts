"use client";

import { collection, query, where, or, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";

export interface StaffAlert { id: string; kind: string; paymentId: string; createdAt: string }

/** Read-only, persistent staff alerts. Studio staff are scoped to their own studio (the rules require it);
 * admin reads the tenant; superadmin also reads unowned captures. No resolve action.
 * The newest50 alerts remain live. A count note in the notice identifies the bounded view.
 * Composite indexes for scoped createdAt ordering are a separate deployment prerequisite. */
export function listenToStaffAlerts(
  scope: { tenantId: string; studioId?: string | null; role: string },
  onData: (alerts: StaffAlert[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const col = collection(db, COLLECTIONS.staffAlerts());
  const q = scope.role === "superadmin"
    ? query(col, or(where("tenantId", "==", scope.tenantId), where("tenantId", "==", null)), orderBy("createdAt", "desc"), limit(50))
    : scope.role === "studio" && scope.studioId
      ? query(col, where("tenantId", "==", scope.tenantId), where("studioId", "==", scope.studioId), orderBy("createdAt", "desc"), limit(50))
      : query(col, where("tenantId", "==", scope.tenantId), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as StaffAlert)), onError);
}
