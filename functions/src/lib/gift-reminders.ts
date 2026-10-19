// Reminds the person holding an ACTIVE gift 7 days before it ends and on its last day. Goes to the account that claimed it,
// else the buyer. One per gift, end date and distance (deterministic id), so a retry or second run never repeats.
import type { Firestore } from "firebase-admin/firestore";
import { giftReminderText, type Gift, type Notification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

const istDay = (ms: number): string => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);

export async function sendGiftReminders(db: Firestore, nowMs: number = Date.now()): Promise<{ sent: number }> {
  const today = istDay(nowMs);
  const in7 = istDay(nowMs + 7 * 86_400_000);
  const snap = await db.collection(COLLECTIONS.gifts()).where("status", "==", "ACTIVE").limit(2000).get();
  let sent = 0;
  for (const d of snap.docs) {
    const g = d.data() as Gift;
    const to = g.claimedBy || g.buyerId;
    if (!to || !g.expiresAt) continue;
    const end = istDay(Date.parse(g.expiresAt));
    const daysLeft = end === today ? 0 : end === in7 ? 7 : null;
    if (daysLeft === null) continue;
    const text = giftReminderText(daysLeft);
    const id = `giftrem-${g.id}-${end}-${daysLeft}`;
    const n: Notification = { id, tenantId: g.tenantId, userId: to, auditLogId: id, type: "expiry_reminder", title: text.title, body: text.body, entityType: "Gift", entityId: g.id, createdAt: new Date(nowMs).toISOString(), readAt: null };
    try { await db.collection(COLLECTIONS.notifications()).doc(id).create(n); sent++; } catch (e) { if ((e as { code?: number }).code !== 6) throw e; }
  }
  return { sent };
}
