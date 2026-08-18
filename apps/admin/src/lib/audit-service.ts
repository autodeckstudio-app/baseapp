"use client";

import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { AuditLog } from "@autodeck/core";

const LIST_LIMIT = 500;

/** Live, tenant-wide audit feed — newest first, append-only by construction
 * (the /auditLog rule denies all client writes). Actor/action/entity/date
 * filters are applied client-side. */
export function listenToAuditLog(
  tenantId: string,
  onData: (entries: AuditLog[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.auditLog()),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
    limit(LIST_LIMIT),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as AuditLog)), onError);
}
