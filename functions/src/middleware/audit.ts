import type { Transaction } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import type { AuditLog, AuditAction } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import type { AuthorizedUser } from "@autodeck/auth";

interface AuditParams {
  action: AuditAction;
  entityType: string;
  entityId: string;
  user: AuthorizedUser;
  studioId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an audit log entry within an existing Firestore transaction.
 * Must be called inside a transaction to guarantee atomicity with the mutation.
 */
export function writeAuditLog(tx: Transaction, params: AuditParams): void {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.auditLog()).doc();

  const entry: AuditLog = {
    id: ref.id,
    tenantId: params.user.claims.tenantId,
    studioId: params.studioId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    performedBy: params.user.uid,
    performedByRole: params.user.claims.role,
    before: params.before ?? null,
    after: params.after ?? null,
    metadata: params.metadata ?? {},
    createdAt: new Date().toISOString(),
  };

  tx.set(ref, entry);
}
