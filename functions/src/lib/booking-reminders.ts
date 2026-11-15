// Reminds the customer 24 hours and 2 hours before a CONFIRMED booking. Runs every 15 minutes (see bookingRemindersScheduled).
// One notification per booking, slot time and distance (deterministic id), so a retry, a second run or an overlap never repeats it,
// and a reschedule (new slot time) gets fresh reminders. A booking made inside the window gets no "24 hours" reminder: it only fires in the
// 15 minutes around the mark. Cancelled, missed and unconfirmed bookings are skipped.
import type { Firestore } from "firebase-admin/firestore";
import { bookingReminderText, type Booking, type Notification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

const MIN = 60_000;
export const REMINDER_WINDOW_MIN = 15;

/** Hours ahead (24 or 2) when `gapMs` falls in the reminder window just under that mark, else null. */
export function reminderMark(gapMs: number): 24 | 2 | null {
  for (const h of [24, 2] as const) {
    const mark = h * 60 * MIN;
    if (gapMs <= mark && gapMs > mark - REMINDER_WINDOW_MIN * MIN) return h;
  }
  return null;
}

const whenLabel = (iso: string): string => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export async function sendBookingReminders(db: Firestore, nowMs: number = Date.now()): Promise<{ sent: number }> {
  const from = new Date(nowMs).toISOString();
  const to = new Date(nowMs + 24 * 60 * MIN).toISOString();
  const snap = await db.collection(COLLECTIONS.bookings()).where("scheduledAt", ">", from).where("scheduledAt", "<=", to).limit(2000).get();
  let sent = 0;
  for (const d of snap.docs) {
    const b = d.data() as Booking;
    if (b.status !== "CONFIRMED" || !b.customerId) continue;
    const h = reminderMark(Date.parse(b.scheduledAt) - nowMs);
    if (h === null) continue;
    const text = bookingReminderText(h, whenLabel(b.scheduledAt));
    const id = `bkrem-${b.id}-${Date.parse(b.scheduledAt)}-${h}`;
    const n: Notification = { id, tenantId: b.tenantId, userId: b.customerId, auditLogId: id, type: "booking_reminder", title: text.title, body: text.body, entityType: "Booking", entityId: b.id, createdAt: new Date(nowMs).toISOString(), readAt: null };
    try { await db.collection(COLLECTIONS.notifications()).doc(id).create(n); sent++; } catch (e) { if ((e as { code?: number }).code !== 6) throw e; }
  }
  return { sent };
}
