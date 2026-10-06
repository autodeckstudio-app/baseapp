// Stamp unarrived bookings and create exactly one notification audit per slot.
// Transaction reads protect against a concurrent arrival, cancellation or reschedule.
import type { Firestore } from "firebase-admin/firestore";
import { isBookingMissed, type Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

export async function flagMissedBookings(db: Firestore, nowMs: number = Date.now()): Promise<{ flagged: number }> {
  const now = new Date(nowMs).toISOString();
  // Single-field range query: no new composite index, and catch up after downtime.
  const snap = await db.collection(COLLECTIONS.bookings()).where("scheduledAt", "<", now).get();
  let flagged = 0;
  for (const doc of snap.docs) {
    if (!isBookingMissed(doc.data() as Booking, nowMs)) continue;
    const wrote = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (!fresh.exists) return false;
      const b = fresh.data() as Booking;
      if (!isBookingMissed(b, nowMs)) return false;
      const id = `missed-${doc.id}-${Date.parse(b.scheduledAt)}`;
      const auditRef = db.collection(COLLECTIONS.auditLog()).doc(id);
      const existing = await tx.get(auditRef);
      if (existing.exists && b.missedForScheduledAt === b.scheduledAt && b.missedAt) return false;
      tx.update(doc.ref, { missedAt: b.missedAt ?? now, missedForScheduledAt: b.scheduledAt, updatedAt: now });
      if (existing.exists) return false;
      tx.create(auditRef, {
        id, tenantId: b.tenantId, studioId: b.studioId ?? null,
        action: "booking.missed", entityType: "Booking", entityId: doc.id,
        performedBy: "system", performedByRole: "system",
        before: { status: b.status }, after: { status: b.status, missed: true },
        metadata: { scheduledAt: b.scheduledAt }, createdAt: now,
      });
      return true;
    });
    if (wrote) flagged++;
  }
  return { flagged };
}
