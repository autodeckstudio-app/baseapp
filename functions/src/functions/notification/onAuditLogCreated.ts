// Phase 2C notification architecture: AuditLog is the sole authoritative
// event source. This Firestore trigger fires on every new audit entry, maps
// it to a customer notification (or no-ops if the action has no customer
// notification), and writes the Notification document. No client ever
// triggers a notification directly, and there is no second event bus.
//
// Idempotency: the Notification document ID is the auditLogId itself
// (matches event.params.logId — the document path, not trusted document
// content). Firestore triggers deliver at-least-once; `.create()` throws
// ALREADY_EXISTS (gRPC code 6) on a redelivered event, which is treated as
// a benign idempotent no-op rather than an error.
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import type { AuditLog, Notification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { buildNotification } from "../../lib/notification-events.js";

const FIRESTORE_ALREADY_EXISTS = 6;

export const onAuditLogCreated = onDocumentCreated(
  { document: "auditLog/{logId}", region: "asia-south1" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const log = snap.data() as AuditLog;
    const logId = event.params.logId;
    const db = getFirestore();

    const draft = await buildNotification(db, log);
    if (!draft) return;

    const notification: Notification = {
      id: logId,
      tenantId: log.tenantId,
      userId: draft.userId,
      auditLogId: logId,
      type: draft.type,
      title: draft.title,
      body: draft.body,
      entityType: draft.entityType,
      entityId: draft.entityId,
      createdAt: new Date().toISOString(),
      readAt: null,
    };

    try {
      await db.collection(COLLECTIONS.notifications()).doc(logId).create(notification);
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === FIRESTORE_ALREADY_EXISTS) return;
      throw err;
    }
  },
);
