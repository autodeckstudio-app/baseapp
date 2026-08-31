// Phase 5C Batch 1: shared sweep logic for expireStaleMemberships and
// expireStaleApprovals, used by BOTH the existing admin-triggered onCall
// (single-tenant, real user as actor) and the new daily onSchedule
// (cross-tenant, no caller — actor is the "system" sentinel below).
//
// Idempotent by construction: each sweep only touches docs still matching
// the stale-status query (active-but-past-endDate / pending-but-past-
// expiresAt). Once a doc is flipped, it no longer matches, so re-running
// the sweep — whether from overlapping schedule executions, a retry, or a
// manual admin trigger shortly after — finds nothing left to do rather
// than double-processing or double-auditing the same document.
import type { Firestore } from "firebase-admin/firestore";
import type { Membership, ApprovalRequest } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

export interface SweepActor {
  uid: string;
  role: string;
}

// Not a real user — no AuthorizedUser exists for a time-triggered function.
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
// index (status + endDate, no leading tenantId) — added to
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

  // One audit entry per membership — bulk sweep, but each is an
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
