// Pushes a plain reminder to members whose ACTIVE plan ends in 7 days or today.
// One per membership, end date and distance (deterministic id), so a retry or second run never repeats.
import type { Firestore } from "firebase-admin/firestore";
import { membershipReminderText, type Membership, type Notification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

const istDay = (ms: number): string => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);

export async function sendMembershipReminders(db: Firestore, nowMs: number = Date.now()): Promise<{ sent: number }> {
  const today = istDay(nowMs);
  const in7 = istDay(nowMs + 7 * 86_400_000);
  const snap = await db.collection(COLLECTIONS.memberships()).where("status", "==", "active").limit(2000).get();
  let sent = 0;
  for (const d of snap.docs) {
    const m = d.data() as Membership;
    if (!m.customerId || !m.endDate) continue;
    const end = m.endDate.slice(0, 10);
    const daysLeft = end === today ? 0 : end === in7 ? 7 : null;
    if (daysLeft === null) continue;
    const text = membershipReminderText(daysLeft, m.tier);
    const id = `memrem-${m.id}-${end}-${daysLeft}`;
    const n: Notification = { id, tenantId: m.tenantId, userId: m.customerId, auditLogId: id, type: "expiry_reminder", title: text.title, body: text.body, entityType: "Membership", entityId: m.id, createdAt: new Date(nowMs).toISOString(), readAt: null };
    try { await db.collection(COLLECTIONS.notifications()).doc(id).create(n); sent++; } catch (e) { if ((e as { code?: number }).code !== 6) throw e; }
  }
  return { sent };
}
