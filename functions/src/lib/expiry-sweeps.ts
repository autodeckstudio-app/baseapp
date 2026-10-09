// Phase 5C Batch 1: shared sweep logic for expireStaleMemberships and
// expireStaleApprovals, used by BOTH the existing admin-triggered onCall
// (single-tenant, real user as actor) and the new daily onSchedule
// (cross-tenant, no caller â actor is the "system" sentinel below).
//
// Idempotent by construction: each sweep only touches docs still matching
// the stale-status query (active-but-past-endDate / pending-but-past-
// expiresAt). Once a doc is flipped, it no longer matches, so re-running
// the sweep â whether from overlapping schedule executions, a retry, or a
// manual admin trigger shortly after â finds nothing left to do rather
// than double-processing or double-auditing the same document.
import type { Firestore } from "firebase-admin/firestore";
import type { Membership, ApprovalRequest, Payment, Tenant } from "@autodeck/core";
import { MEMBERSHIP_PENDING_EXPIRY_HOURS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

export interface SweepActor {
  uid: string;
  role: string;
}

// Not a real user â no AuthorizedUser exists for a time-triggered function.
// performedBy/performedByRole on AuditLog are plain strings (no FK/role-enum
// constraint), so a sentinel is a safe, explicit way to distinguish
// system-initiated audit entries from admin-initiated ones without
// inventing a new schema.
export const SYSTEM_ACTOR: SweepActor = { uid: "system", role: "system" };

export interface SweepResult {
  expiredCount: number;
}

// tenantId omitted => sweeps ALL tenants (the scheduled path). Provided =>
// scoped to one tenant (the existing admin onCall path's exact prior
// behavior, byte-for-byte). The cross-tenant query needs its own composite
// index (status + endDate, no leading tenantId) â added to
// firestore.indexes.json alongside this change.
export async function sweepStaleMemberships(
  db: Firestore,
  options: { tenantId?: string; actor?: SweepActor } = {},
): Promise<SweepResult> {
  const actor = options.actor ?? SYSTEM_ACTOR;
  const today = new Date().toISOString().slice(0, 10);

  let query: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.memberships())
    .where("status", "==", "active")
    .where("endDate", "<", today);
  if (options.tenantId) {
    query = query.where("tenantId", "==", options.tenantId);
  }

  const snap = await query.get();
  if (snap.empty) return { expiredCount: 0 };

  const now = new Date().toISOString();
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: "expired", updatedAt: now });
  }
  await batch.commit();

  // One audit entry per membership â bulk sweep, but each is an
  // individually auditable state change. tenantId is read from each
  // document (not the caller) so this stays correct for the cross-tenant
  // sweep too.
  const auditBatch = db.batch();
  for (const doc of snap.docs) {
    const membership = doc.data() as Membership;
    const ref = db.collection(COLLECTIONS.auditLog()).doc();
    auditBatch.set(ref, {
      id: ref.id,
      tenantId: membership.tenantId,
      studioId: null,
      action: "membership.expired",
      entityType: "Membership",
      entityId: doc.id,
      performedBy: actor.uid,
      performedByRole: actor.role,
      before: { status: "active", endDate: membership.endDate },
      after: { status: "expired" },
      metadata: {},
      createdAt: now,
    });
  }
  await auditBatch.commit();

  return { expiredCount: snap.docs.length };
}

export interface PendingSweepResult {
  cancelledCount: number;
}

// Cancels 'pending' membership purchases that were never paid/confirmed within
// the allowed window (Tenant.membershipPendingExpiryHours, default
// MEMBERSHIP_PENDING_EXPIRY_HOURS = 48). Only ever touches status='pending'
// records â paid active memberships and completed payment evidence are never
// modified. Linked still-open payment records are marked cancelled so they
// stop looking in-flight; the documents themselves are preserved.
export async function sweepStalePendingMemberships(
  db: Firestore,
  options: { tenantId?: string; actor?: SweepActor } = {},
): Promise<PendingSweepResult> {
  const actor = options.actor ?? SYSTEM_ACTOR;

  let query: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.memberships())
    .where("status", "==", "pending");
  if (options.tenantId) {
    query = query.where("tenantId", "==", options.tenantId);
  }

  const snap = await query.get();
  if (snap.empty) return { cancelledCount: 0 };

  // Per-tenant configurable window, cached per tenant document read.
  const expiryHoursByTenant = new Map<string, number>();
  const expiryHoursFor = async (tenantId: string): Promise<number> => {
    const cached = expiryHoursByTenant.get(tenantId);
    if (cached !== undefined) return cached;
    const tenantSnap = await db.collection(COLLECTIONS.tenants()).doc(tenantId).get();
    const hours = (tenantSnap.data() as Tenant | undefined)?.membershipPendingExpiryHours ?? MEMBERSHIP_PENDING_EXPIRY_HOURS;
    expiryHoursByTenant.set(tenantId, hours);
    return hours;
  };

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const stale: Array<{ ref: FirebaseFirestore.DocumentReference; membership: Membership }> = [];
  for (const doc of snap.docs) {
    const membership = doc.data() as Membership;
    const hours = await expiryHoursFor(membership.tenantId);
    if (nowMs - Date.parse(membership.createdAt) >= hours * 3600000) {
      stale.push({ ref: doc.ref, membership });
    }
  }
  if (stale.length === 0) return { cancelledCount: 0 };

  const batch = db.batch();
  for (const { ref, membership } of stale) {
    batch.update(ref, {
      status: "cancelled",
      cancelledAt: now,
      cancelledBy: actor.uid,
      cancellationReason: "pending_payment_expired",
      updatedAt: now,
    });
    const openPayments = await db
      .collection(COLLECTIONS.payments())
      .where("membershipId", "==", membership.id)
      .where("status", "in", ["pending", "processing"])
      .get();
    for (const payDoc of openPayments.docs) {
      batch.update(payDoc.ref, { status: "cancelled", cancelledAt: now, updatedAt: now });
    }
  }
  await batch.commit();

  const auditBatch = db.batch();
  for (const { membership } of stale) {
    const ref = db.collection(COLLECTIONS.auditLog()).doc();
    auditBatch.set(ref, {
      id: ref.id,
      tenantId: membership.tenantId,
      studioId: null,
      action: "membership.cancelled",
      entityType: "Membership",
      entityId: membership.id,
      performedBy: actor.uid,
      performedByRole: actor.role,
      before: { status: "pending" },
      after: { status: "cancelled", reason: "pending_payment_expired" },
      metadata: {},
      createdAt: now,
    });
  }
  await auditBatch.commit();

  return { cancelledCount: stale.length };
}

export async function sweepStaleApprovals(
  db: Firestore,
  options: { tenantId?: string; actor?: SweepActor } = {},
): Promise<SweepResult> {
  const actor = options.actor ?? SYSTEM_ACTOR;
  const now = new Date().toISOString();

  let query: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.approvals())
    .where("status", "==", "pending")
    .where("expiresAt", "<", now);
  if (options.tenantId) {
    query = query.where("tenantId", "==", options.tenantId);
  }

  const snap = await query.get();
  if (snap.empty) return { expiredCount: 0 };

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: "expired" });
  }
  await batch.commit();

  const auditBatch = db.batch();
  for (const doc of snap.docs) {
    const approval = doc.data() as ApprovalRequest;
    const ref = db.collection(COLLECTIONS.auditLog()).doc();
    auditBatch.set(ref, {
      id: ref.id,
      tenantId: approval.tenantId,
      studioId: null,
      action: "approval.expired",
      entityType: "ApprovalRequest",
      entityId: doc.id,
      performedBy: actor.uid,
      performedByRole: actor.role,
      before: { status: "pending" },
      after: { status: "expired" },
      metadata: {},
      createdAt: now,
    });
  }
  await auditBatch.commit();

  return { expiredCount: snap.docs.length };
}
