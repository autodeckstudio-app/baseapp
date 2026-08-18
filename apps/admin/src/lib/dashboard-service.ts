"use client";

import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ApprovalRequest, Membership } from "@autodeck/core";

// Reuses the existing tenantId+status(+expiresAt) approvals index as a prefix
// match (equality-only query, no orderBy) — no new index required.
export function listenToPendingApprovals(
  tenantId: string,
  onData: (approvals: ApprovalRequest[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.approvals()),
    where("tenantId", "==", tenantId),
    where("status", "==", "pending"),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as ApprovalRequest)), onError);
}

// Soonest-expiring active memberships — reuses the existing
// tenantId+status+endDate index exactly.
export function listenToExpiringMemberships(
  tenantId: string,
  onData: (memberships: Membership[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.memberships()),
    where("tenantId", "==", tenantId),
    where("status", "==", "active"),
    orderBy("endDate", "asc"),
    limit(20),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Membership)), onError);
}
