// Pay-online bookings hold their slot for HOLD_MINUTES. Pure rules here, the sweep below.
import type { Firestore } from "firebase-admin/firestore";
import type { Booking, ServiceJob, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { writeAuditLog } from "../middleware/audit.js";
import type { AuthorizedUser } from "@autodeck/auth";
import { readCancelReads, writeCancelRestores } from "./cancel-booking.js";

export const HOLD_MINUTES = 15;

export type PayMode = "online" | "studio";

/** Online payment holds the slot as PENDING. Free visits (gift, member wash), quotes and pay-at-studio are confirmed at once. */
export function bookingStartState(i: { payMode: PayMode | undefined; totalPaise: number; priceOnRequest: boolean; nowMs: number }): { status: "PENDING" | "CONFIRMED"; holdExpiresAt: string | null } {
  if (i.payMode === "online" && i.totalPaise > 0 && !i.priceOnRequest) {
    return { status: "PENDING", holdExpiresAt: new Date(i.nowMs + HOLD_MINUTES * 60_000).toISOString() };
  }
  return { status: "CONFIRMED", holdExpiresAt: null };
}

export function isHoldExpired(b: Pick<Booking, "status" | "paymentStatus"> & { holdExpiresAt?: string | null }, nowMs: number): boolean {
  return b.status === "PENDING" && b.paymentStatus === "unpaid" && !!b.holdExpiresAt && Date.parse(b.holdExpiresAt) <= nowMs;
}

function systemUser(tenantId: string): AuthorizedUser {
  return { uid: "system", displayName: "AutoDeck", email: null, claims: { role: "system", tenantId, studioId: null } } as unknown as AuthorizedUser;
}

/** Releases bookings whose 15 minutes ended without payment. The payment is re-read inside the transaction, so money that lands as the hold ends wins. */
export async function sweepExpiredBookingHolds(db: Firestore, nowMs = Date.now()): Promise<{ expired: number; skipped: number }> {
  const snap = await db.collection(COLLECTIONS.bookings()).where("status", "==", "PENDING").limit(300).get();
  let expired = 0, skipped = 0;
  for (const d of snap.docs) {
    const ok = await db.runTransaction(async (tx) => {
      const bRef = d.ref;
      const b = (await tx.get(bRef)).data() as (Booking & { holdExpiresAt?: string | null }) | undefined;
      if (!b || !isHoldExpired(b, nowMs)) return false;
      const jobs = await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId", "==", b.id).limit(1));
      const jobDoc = jobs.docs[0];
      const pays = jobDoc ? await tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", jobDoc.id).where("status", "in", ["processing", "completed"]).limit(1)) : null;
      if (pays && !pays.empty) return false; // paid or paying: not ours to expire
      const open = jobDoc ? await tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", jobDoc.id).where("status", "==", "pending").limit(10)) : null;
      const reads = await readCancelReads(tx, db, b, b.id);
      const now = new Date(nowMs).toISOString();
      writeCancelRestores(tx, reads, b, b.id, systemUser(b.tenantId), now, `Payment not completed: ${b.id}`);
      for (const p of open?.docs ?? []) tx.update(p.ref, { status: "cancelled", cancelledAt: now, updatedAt: now } satisfies Partial<Payment>);
      tx.update(bRef, { status: "EXPIRED", updatedAt: now });
      if (jobDoc) {
        const j = jobDoc.data() as ServiceJob;
        tx.update(jobDoc.ref, { status: "CANCELLED", statusHistory: [...j.statusHistory, { status: "CANCELLED", changedAt: now, changedBy: "system", notes: "Payment not completed in time" }], updatedAt: now });
      }
      writeAuditLog(tx, { action: "booking.expired", entityType: "Booking", entityId: b.id, user: systemUser(b.tenantId), studioId: b.studioId, before: { status: "PENDING" }, after: { status: "EXPIRED" } });
      return true;
    });
    if (ok) expired++; else skipped++;
  }
  return { expired, skipped };
}
