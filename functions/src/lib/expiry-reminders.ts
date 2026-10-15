// Pushes a plain reminder for verified papers that expire in 30 days, 7 days or today.
// Writes a Notification (the push trigger sends it). The id is per paper, expiry date and distance, so a retry or a second run cannot double-send.
import type { Firestore } from "firebase-admin/firestore";
import { expiryReminderText, reminderTargetDates, type Notification, type PaperVerification, type Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

const istToday = (nowMs: number): string => new Date(nowMs + 330 * 60_000).toISOString().slice(0, 10);

export async function sendExpiryReminders(db: Firestore, nowMs: number = Date.now()): Promise<{ sent: number }> {
  const targets = reminderTargetDates(istToday(nowMs));
  const snap = await db.collection(COLLECTIONS.papers()).where("expiresOn", "in", targets.map((t) => t.date)).limit(2000).get();
  let sent = 0;
  for (const d of snap.docs) {
    const p = d.data() as PaperVerification;
    if (p.status !== "VERIFIED" || !p.customerId || !p.expiresOn) continue;
    const t = targets.find((x) => x.date === p.expiresOn);
    if (!t) continue;
    const v = await db.collection(COLLECTIONS.vehicles()).doc(p.vehicleId).get();
    const vehicle = v.exists ? (v.data() as Vehicle) : null;
    if (vehicle?.deletedAt) continue;
    const text = expiryReminderText(p.kind, t.daysLeft, vehicle?.registrationNumber ?? null);
    const id = `expiry-${p.id}-${p.expiresOn}-${t.daysLeft}`;
    const n: Notification = { id, tenantId: p.tenantId, userId: p.customerId, auditLogId: id, type: "expiry_reminder", title: text.title, body: text.body, entityType: null, entityId: null, createdAt: new Date(nowMs).toISOString(), readAt: null };
    try { await db.collection(COLLECTIONS.notifications()).doc(id).create(n); sent++; } catch (e) { if ((e as { code?: number }).code !== 6) throw e; }
  }
  return { sent };
}
