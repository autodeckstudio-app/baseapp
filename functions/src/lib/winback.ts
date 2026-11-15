// Plain "we miss you" nudge for customers whose last delivered visit is 90+ days old. No offer, no discount.
// Writes a Notification document (the push trigger sends it). The id is per customer and month, so a retry cannot double-send.
import type { Firestore } from "firebase-admin/firestore";
import { selectWinbackTargets, type Notification, type ServiceJob, type Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

const OPEN = ["PENDING", "CONFIRMED", "ACTIVE"];
export const WINBACK_TITLE = "We miss you";
export const WINBACK_BODY = "It has been a while since your last visit. Book whenever you are ready.";

export async function sendWinbackNudges(db: Firestore, nowMs: number = Date.now()): Promise<{ sent: number }> {
  const jobs = await db.collection(COLLECTIONS.jobs()).where("status", "==", "DELIVERED").limit(5000).get();
  const lastVisit: Record<string, string> = {};
  const tenantOf: Record<string, string> = {};
  for (const d of jobs.docs) {
    const j = d.data() as ServiceJob;
    const at = j.sealedAt ?? j.createdAt;
    if (!j.customerId) continue;
    tenantOf[j.customerId] = j.tenantId;
    if (!lastVisit[j.customerId] || at > lastVisit[j.customerId]!) lastVisit[j.customerId] = at;
  }
  const open = await db.collection(COLLECTIONS.bookings()).where("status", "in", OPEN).limit(5000).get();
  const hasOpenBooking = new Set(open.docs.map((d) => (d.data() as Booking).customerId));
  const nudges = await db.collection(COLLECTIONS.notifications()).where("type", "==", "winback").limit(5000).get();
  const lastNudge: Record<string, string> = {};
  for (const d of nudges.docs) {
    const n = d.data() as Notification;
    if (!lastNudge[n.userId] || n.createdAt > lastNudge[n.userId]!) lastNudge[n.userId] = n.createdAt;
  }
  const targets = selectWinbackTargets({ lastVisit, hasOpenBooking, lastNudge, now: nowMs });
  const month = new Date(nowMs).toISOString().slice(0, 7);
  let sent = 0;
  for (const userId of targets) {
    const id = `winback-${userId}-${month}`;
    const n: Notification = { id, tenantId: tenantOf[userId]!, userId, auditLogId: id, type: "winback", title: WINBACK_TITLE, body: WINBACK_BODY, entityType: null, entityId: null, createdAt: new Date(nowMs).toISOString(), readAt: null };
    try { await db.collection(COLLECTIONS.notifications()).doc(id).create(n); sent++; } catch (e) { if ((e as { code?: number }).code !== 6) throw e; }
  }
  return { sent };
}
