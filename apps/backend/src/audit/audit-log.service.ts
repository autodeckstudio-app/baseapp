import { Inject, Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';

export interface AuditLogEntry {
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  requestId: string;
}

/**
 * Append-only by construction: this service only ever calls `.add()`
 * (create). There is no update/delete method here, and the Firestore rules
 * independently deny update/delete on this collection for every role —
 * two layers enforcing the same guarantee.
 */
@Injectable()
export class AuditLogService {
  constructor(@Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App) {}

  async record(entry: AuditLogEntry): Promise<string> {
    const firestore = this.app.firestore();
    const ref = await firestore.collection('auditLogs').add({
      ...entry,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  /**
   * Adds the audit write to an already-open Firestore `WriteBatch` instead
   * of committing independently — this is what makes it possible for a
   * mutation (e.g. a `staff` document write) and its audit record to be
   * committed atomically, together, by whoever calls `batch.commit()`.
   * Still append-only: only ever a `.set()` on a new document reference,
   * never an update to an existing one.
   */
  recordInBatch(batch: FirebaseFirestore.WriteBatch, entry: AuditLogEntry): void {
    const firestore = this.app.firestore();
    const ref = firestore.collection('auditLogs').doc();
    batch.set(ref, {
      ...entry,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
