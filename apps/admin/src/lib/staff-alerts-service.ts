"use client";

import { collection, query, where, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";

export interface StaffAlert { id: string; kind: string; paymentId: string; createdAt: string }

/** Read-only, persistent staff alerts. Studio staff are scoped to their own studio (the rules require it);
 * admin and superadmin read the whole tenant. There is no resolve action. */
export function listenToStaffAlerts(
  scope: { tenantId: string; studioId?: string | null; role: string },
  onData: (alerts: StaffAlert[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const base = [collection(db, COLLECTIONS.staffAlerts()), where("tenantId", "==", scope.tenantId)] as const;
  const q = scope.role === "studio" && scope.studioId
    ? query(base[0], base[1], where("studioId", "==", scope.studioId), limit(50))
    : query(base[0], base[1], limit(50));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as StaffAlert)), onError);
}
