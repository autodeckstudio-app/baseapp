// Once per missed booking: write one audit entry (booking.missed). The audit
// log is the sole notification source, so onAuditLogCreated turns it into the
// customer notification (and push). The audit doc ID is deterministic
// (bookingId + start time), so re-runs and overlapping schedules cannot
// notify twice, and a booking moved to a new time can be flagged again later.
// No booking fields are written. Query uses only the scheduledAt range, so
// it needs no composite index.
import type { Firestore } from "firebase-admin/firestore";
import { isBookingMissed, MISSED_BOOKING_GRACE_HOURS, type Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

const LOOKBACK_HOURS = 72;
const ALREADY_EXISTS = 6;

export async function flagMissedBookings(db: Firestore, nowMs: number = Date.now()): Promise<{ flagged: number }> {
  const from = new Date(nowMs - LOOKBACK_HOURS * 3600000).toISOString();
  const to = new Date(nowMs - MISSED_BOOKING_GRACE_HOURS * 3600000).toISOString();
  const snap = await db.collection(COLLECTIONS.bookings()).where("scheduledAt", ">=", from).where("scheduledAt", "<", to).get();
  let flagged = 0;
  for (const doc of snap.docs) {
    const b = doc.data() as Booking;
    if (!isBookingMissed(b, nowMs)) continue;
    const id = `missed-${doc.id}-${Date.parse(b.scheduledAt)}`;
    try {
      await db.collection(COLLECTIONS.auditLog()).doc(id).create({
        id,
        tenantId: b.tenantId,
        studioId: b.studioId ?? null,
        action: "booking.missed",
        entityType: "Booking",
        entityId: doc.id,
        performedBy: "system",
        performedByRole: "system",
        before: { status: b.status },
        after: { status: b.status, missed: true },
        metadata: {},
        createdAt: new Date(nowMs).toISOString(),
      });
      flagged++;
    } catch (err) {
      if ((err as { code?: number }).code !== ALREADY_EXISTS) throw err;
    }
  }
  return { flagged };
}
