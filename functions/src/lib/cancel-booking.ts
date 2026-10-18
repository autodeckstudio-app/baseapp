// Shared cancel rules for cancelBooking, adminCancelBooking and the close-time auto-cancel.
// Pure arithmetic first (unit tested), then the transaction helpers: every read happens in readCancelReads,
// every write in writeCancelRestores, so callers keep Firestore's reads-before-writes rule.
import type { Firestore, Transaction, DocumentReference, DocumentSnapshot } from "firebase-admin/firestore";
import type { Booking, Membership } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import type { AuthorizedUser } from "@autodeck/auth";
import { writeAuditLog } from "../middleware/audit.js";

export interface RefundPlan {
  /** Paise the customer paid in total. */
  paidPaise: number;
  /** Fee actually charged: never more than was paid when money was taken. Zero when waived. */
  feePaise: number;
  /** Paise sent back. Floor 0, never above paid. */
  refundPaise: number;
  feeStatus: "none" | "due" | "withheld" | "waived";
}

/** Fee and refund for a cancel. Paid money pays the fee first (the rest goes back); an unpaid booking just records the fee as due. */
export function planRefund(i: { paidPaise: number; feePaise: number; waive: boolean }): RefundPlan {
  const paid = Math.max(0, Math.round(i.paidPaise));
  const fee = Math.max(0, Math.round(i.feePaise));
  if (i.waive || fee === 0) return { paidPaise: paid, feePaise: 0, refundPaise: paid, feeStatus: fee > 0 ? "waived" : "none" };
  if (paid === 0) return { paidPaise: 0, feePaise: fee, refundPaise: 0, feeStatus: "due" };
  const charged = Math.min(fee, paid);
  return { paidPaise: paid, feePaise: charged, refundPaise: Math.max(0, paid - charged), feeStatus: "withheld" };
}

export interface CancelReads {
  membership: { ref: DocumentReference; snap: DocumentSnapshot } | null;
  gift: { ref: DocumentReference; snap: DocumentSnapshot } | null;
  pickup: { ref: DocumentReference; snap: DocumentSnapshot };
  pickupMembership: { ref: DocumentReference; snap: DocumentSnapshot } | null;
}

export async function readCancelReads(tx: Transaction, db: Firestore, booking: Booking & { id?: string }, bookingId: string): Promise<CancelReads> {
  const read = async (ref: DocumentReference) => ({ ref, snap: await tx.get(ref) });
  const membership = booking.membershipId ? await read(db.collection(COLLECTIONS.memberships()).doc(booking.membershipId)) : null;
  const giftId = (booking as { giftId?: string }).giftId;
  const gift = giftId ? await read(db.collection(COLLECTIONS.gifts()).doc(giftId)) : null;
  const pRef = db.collection(COLLECTIONS.pickupRequests()).doc(bookingId);
  const pSnap = await tx.get(pRef);
  const heldId = pSnap.exists ? (pSnap.data() as { memberMembershipId?: string | null }).memberMembershipId ?? null : null;
  const pickupMembership = heldId && heldId !== booking.membershipId
    ? await read(db.collection(COLLECTIONS.memberships()).doc(heldId))
    : null;
  return { membership, gift, pickup: { ref: pRef, snap: pSnap }, pickupMembership };
}

/**
 * Gives back everything a cancelled booking was holding: the membership wash, the member's free pickup, the redeemed gift.
 * Closes any open pickup request. Each restore is tied to a stored marker on the booking/pickup/gift, so a second call changes nothing.
 */
export function writeCancelRestores(tx: Transaction, reads: CancelReads, booking: Booking, bookingId: string, user: AuthorizedUser, now: string, note: string, audit = true): void {
  const memberUpdates = new Map<string, { ref: DocumentReference; m: Membership; washes: number; pickups: number }>();
  const bump = (ref: DocumentReference, snap: DocumentSnapshot | undefined) => {
    if (!snap?.exists) return null;
    const hit = memberUpdates.get(ref.id) ?? { ref, m: snap.data() as Membership, washes: 0, pickups: 0 };
    memberUpdates.set(ref.id, hit);
    return hit;
  };

  if (booking.membershipWashUsed && reads.membership) {
    const hit = bump(reads.membership.ref, reads.membership.snap);
    if (hit) hit.washes += 1;
  }

  const p = reads.pickup.snap.exists ? (reads.pickup.snap.data() as { status?: string; memberMembershipId?: string | null }) : null;
  if (p && (p.status === "REQUESTED" || p.status === "CONFIRMED")) {
    const held = p.memberMembershipId ?? null;
    const src = held && held === booking.membershipId ? reads.membership : reads.pickupMembership;
    if (held && src) {
      const hit = bump(src.ref, src.snap);
      if (hit) hit.pickups += 1;
    }
    tx.update(reads.pickup.ref, { status: "DECLINED", staffNote: "Booking cancelled", memberMembershipId: null, feeBilled: false, updatedAt: now });
  }

  for (const { ref, m, washes, pickups } of memberUpdates.values()) {
    const patch: Record<string, unknown> = { updatedAt: now };
    if (washes) patch["washesUsed"] = Math.max(0, m.washesUsed - washes);
    if (pickups) patch["pickupsUsed"] = Math.max(0, (m.pickupsUsed ?? 0) - pickups);
    tx.update(ref, patch);
    if (washes && audit) {
      writeAuditLog(tx, { action: "membership.wash_restored", entityType: "Membership", entityId: ref.id, user, studioId: booking.studioId, before: { washesUsed: m.washesUsed }, after: { washesUsed: Math.max(0, m.washesUsed - washes), reason: note } });
    }
  }

  const g = reads.gift;
  if (g?.snap.exists) {
    const gift = g.snap.data() as { status?: string; bookingId?: string | null };
    if (gift.status === "REDEEMED" && gift.bookingId === bookingId) {
      tx.update(g.ref, { status: "ACTIVE", redeemedBy: null, redeemedAt: null, bookingId: null });
      if (audit) writeAuditLog(tx, { action: "gift.restored", entityType: "Gift", entityId: g.ref.id, user, studioId: booking.studioId, after: { bookingId, reason: note } });
    }
  }
}
