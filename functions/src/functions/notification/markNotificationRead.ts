// Customer-only. The sole client-facing mutation on /notifications — sets
// readAt on the caller's own notification. Every other field (title, body,
// userId, tenantId, ...) is immutable via this or any other client path;
// Cloud Functions (this one) are the only notification writers at all
// (Phase 2C security requirement).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Notification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { markNotificationReadSchema } from "../../schemas/notification.js";

export const markNotificationRead = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");

  const data = validate(markNotificationReadSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "notification.markRead");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.notifications()).doc(data.notificationId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Notification not found.");

    const notification = snap.data() as Notification;
    assertTenant(user, notification.tenantId);
    if (notification.userId !== user.uid) {
      throw new HttpsError("permission-denied", "Cannot alter another customer's notification.");
    }

    if (notification.readAt !== null) return; // already read — idempotent no-op

    tx.update(ref, { readAt: new Date().toISOString() });
  });

  return { notificationId: data.notificationId };
});
