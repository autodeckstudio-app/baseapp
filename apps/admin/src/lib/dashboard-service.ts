"use client";

import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ApprovalRequest, AttendanceRecord, InventoryItem, Membership, PaperVerification } from "@autodeck/core";

// Reuses the existing tenantId+status(+expiresAt) approvals index as a prefix
// match (equality-only query, no orderBy) — no new index required. No
// client-side lazy correction for past-expiry approvals (see the identical
// note in apps/studio/src/lib/approval-service.ts) — kept accurate instead
// by the daily expireStaleApprovalsScheduled sweep.
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
// tenantId+status+endDate index exactly. Raw stored status, no read-time
// correction (unlike getMyMemberships' getEffectiveMembershipStatus) —
// kept accurate instead by the daily expireStaleMembershipsScheduled sweep.
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

/** Staff marked present/half-day at one studio today (Kolkata date). */
export function listenToTodayAttendance(
  tenantId: string,
  studioId: string,
  date: string,
  onData: (presentCount: number) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.attendance()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("date", "==", date),
  );
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs
          .map((d) => d.data() as AttendanceRecord)
          .filter((r) => r.status === "PRESENT" || r.status === "HALF_DAY").length,
      ),
    onError,
  );
}

/** Active items at or below their low-stock threshold. */
export function listenToLowStock(
  tenantId: string,
  studioId: string,
  onData: (count: number) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.inventoryItems()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("active", "==", true),
  );
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => d.data() as InventoryItem).filter((i) => i.stockQty <= i.lowStockThreshold).length,
      ),
    onError,
  );
}

/** Papers awaiting office verification. */
export function listenToPendingPapers(
  tenantId: string,
  studioId: string,
  onData: (count: number) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.papers()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("status", "==", "PENDING"),
  );
  return onSnapshot(q, (snap) => onData(snap.size), onError);
}
