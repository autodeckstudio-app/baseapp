// Cancel unarrived bookings at studio close. Transaction reads protect arrivals,
// cancellations and reschedules, and restore an unused membership wash once.
import type { Firestore } from "firebase-admin/firestore";
import { isBookingMissed, type Booking, type ServiceJob, type Membership } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

export async function flagMissedBookings(db: Firestore, nowMs: number = Date.now()): Promise<{ flagged: number }> {
  const now = new Date(nowMs).toISOString();
  const snap = await db.collection(COLLECTIONS.bookings()).where("scheduledAt", "<", now).get();
  let flagged = 0;
  for (const doc of snap.docs) {
    if (!isBookingMissed(doc.data() as Booking, nowMs)) continue;
    const wrote = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (!fresh.exists) return false;
      const b = fresh.data() as Booking;
      if (!isBookingMissed(b, nowMs)) return false;
      const jobs = await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId", "==", doc.id));
      // STANDBY means the vehicle arrived but has not yet been admitted to a bay.
      if (jobs.docs.some((d) => d.data()["status"] !== "PENDING_VEHICLE" && d.data()["status"] !== "CANCELLED")) return false;
      const membershipRef = b.membershipWashUsed && b.membershipId ? db.collection(COLLECTIONS.memberships()).doc(b.membershipId) : null;
      const membershipSnap = membershipRef ? await tx.get(membershipRef) : null;
      const id = `auto-cancel-${doc.id}-${Date.parse(b.scheduledAt)}`;
      const auditRef = db.collection(COLLECTIONS.auditLog()).doc(id);
      const existing = await tx.get(auditRef);
      const reason = "Auto-cancelled: vehicle did not arrive by studio close.";
      tx.update(doc.ref, { status: "CANCELLED", cancelledAt: now, cancellationReason: reason, missedAt: b.missedAt ?? now, missedForScheduledAt: b.scheduledAt, updatedAt: now });
      for (const jobDoc of jobs.docs) {
        const job = jobDoc.data() as ServiceJob;
        if (job.status === "PENDING_VEHICLE") tx.update(jobDoc.ref, { status: "CANCELLED", statusHistory: [...(job.statusHistory ?? []), { status: "CANCELLED", changedAt: now, changedBy: "system", notes: reason }], updatedAt: now });
      }
      if (membershipRef && membershipSnap?.exists) {
        const m = membershipSnap.data() as Membership;
        tx.update(membershipRef, { washesUsed: Math.max(0, m.washesUsed - 1), updatedAt: now });
      }
      if (!existing.exists) tx.create(auditRef, {
        id, tenantId: b.tenantId, studioId: b.studioId ?? null,
        action: "booking.cancelled", entityType: "Booking", entityId: doc.id,
        performedBy: "system", performedByRole: "system",
        before: { status: b.status }, after: { status: "CANCELLED", cancellationReason: reason },
        metadata: { scheduledAt: b.scheduledAt, autoCancelled: true }, createdAt: now,
      });
      return true;
    });
    if (wrote) flagged++;
  }
  return { flagged };
}
