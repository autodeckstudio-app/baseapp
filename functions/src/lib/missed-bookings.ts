import { unresolvedCancel } from "./waiting-cancel.js";
// Cancel unarrived bookings at studio close. Transaction reads protect arrivals,
// cancellations and reschedules, and restore an unused membership wash once.
import type { Firestore } from "firebase-admin/firestore";
import { isBookingMissed, cancellationTerms, type Booking, type ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import type { AuthorizedUser } from "@autodeck/auth";
import { readCancelReads, writeCancelRestores } from "./cancel-booking.js";

export async function flagMissedBookings(db: Firestore, nowMs: number = Date.now()): Promise<{ flagged: number }> {
  const now = new Date(nowMs).toISOString();
  const snap = await db.collection(COLLECTIONS.bookings()).where("scheduledAt", "<", now).get();
  let flagged = 0;
  for (const doc of snap.docs) {
    if (unresolvedCancel(doc.data() as Booking) || !isBookingMissed(doc.data() as Booking, nowMs)) continue;
    const wrote = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (!fresh.exists) return false;
      const b = fresh.data() as Booking;
      if (unresolvedCancel(b) || !isBookingMissed(b, nowMs)) return false;
      const jobs = await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId", "==", doc.id));
      // STANDBY means the vehicle arrived but has not yet been admitted to a bay.
      if (jobs.docs.some((d) => d.data()["status"] !== "PENDING_VEHICLE" && d.data()["status"] !== "CANCELLED")) return false;
      // Every credit the booking held (wash, member pickup, gift) goes back once; the pickup request is closed.
      const reads = await readCancelReads(tx, db, b, doc.id);
      // A visit that never arrived is a late cancel: the normal tier fee is recorded for the studio to settle.
      let categories = (b as { cancelCategories?: string[] }).cancelCategories ?? [];
      if (!categories.length && b.serviceId) {
        const svc = await tx.get(db.collection(COLLECTIONS.services()).doc(b.serviceId));
        if (svc.exists) categories = [String((svc.data() as { category?: string }).category ?? "")];
      }
      const feePaise = categories.length ? cancellationTerms({ categories, totalPaise: b.totalAmount, scheduledAtMs: Date.parse(b.scheduledAt), nowMs }).feePaise : 0;
      const system = { uid: "system", email: null, displayName: "AutoDeck", claims: { tenantId: b.tenantId, role: "system", studioId: b.studioId ?? null } } as unknown as AuthorizedUser;
      const id = `auto-cancel-${doc.id}-${Date.parse(b.scheduledAt)}`;
      const auditRef = db.collection(COLLECTIONS.auditLog()).doc(id);
      const existing = await tx.get(auditRef);
      const reason = "Auto-cancelled: vehicle did not arrive by studio close.";
      tx.update(doc.ref, { status: "CANCELLED", cancelledAt: now, cancelledBy: "system", cancellationReason: reason, cancellationFeePaise: feePaise, ...(feePaise > 0 ? { cancellationFeeStatus: "due" } : {}), missedAt: b.missedAt ?? now, missedForScheduledAt: b.scheduledAt, updatedAt: now });
      for (const jobDoc of jobs.docs) {
        const job = jobDoc.data() as ServiceJob;
        if (job.status === "PENDING_VEHICLE") tx.update(jobDoc.ref, { status: "CANCELLED", statusHistory: [...(job.statusHistory ?? []), { status: "CANCELLED", changedAt: now, changedBy: "system", notes: reason }], updatedAt: now });
      }
      writeCancelRestores(tx, reads, b, doc.id, system, now, reason, false);
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
