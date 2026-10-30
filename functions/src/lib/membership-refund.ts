import type { DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import type { Membership, Payment } from "@autodeck/core";
import type { AuthorizedUser } from "@autodeck/auth";
import { COLLECTIONS } from "@autodeck/database";
import { writeAuditLog } from "../middleware/audit.js";

function refundSystemUser(tenantId: string): AuthorizedUser {
  return { uid: "system", displayName: "AutoDeck", email: null, claims: { role: "system", tenantId, studioId: null } } as unknown as AuthorizedUser;
}

/**
 * Owner policy (Meet, 30 Oct 2026, iMessage thread: "only full membership no half
 * membership", confirmed "Yes" to always-full refunds + full refund stops
 * benefits): a FULL refund of a membership payment ends that membership's
 * benefits. Partial membership refunds are not offered; if one ever arrives it
 * is money evidence only - the membership is untouched and staff get an alert.
 *
 * Guardrails:
 *  - Only the membership the payment itself activated (payment.membershipId) is
 *    ever touched. An older membership ended by an upgrade stays ended; any
 *    OTHER active membership (different payment) is never read or written here.
 *  - Booking/gift/invoice refund behavior is unchanged.
 */

/** Read the membership a refunded payment belongs to. Call BEFORE any write in the transaction (Firestore all-reads-first). */
export async function readMembershipForRefund(tx: Transaction, db: Firestore, payment: Pick<Payment, "targetType"> & { membershipId?: string | null }): Promise<{ ref: DocumentReference; data: Membership } | null> {
  if (payment.targetType !== "membership" || !payment.membershipId) return null;
  const ref = db.collection(COLLECTIONS.memberships()).doc(payment.membershipId);
  const snap = await tx.get(ref);
  if (!snap.exists) return null;
  return { ref, data: snap.data() as Membership };
}

/**
 * Full refund: end the membership's benefits (active or pending both end - a
 * pending membership whose payment is refunded must never activate later).
 * Already-ended memberships (cancelled/expired) are left as they are.
 */
export function deactivateRefundedMembershipInTx(
  tx: Transaction,
  membership: { ref: DocumentReference; data: Membership },
  payment: Pick<Payment, "id">,
  now: string,
): void {
  const before = membership.data.status;
  if (before !== "active" && before !== "pending") return;
  const user = refundSystemUser(membership.data.tenantId);
  tx.update(membership.ref, {
    status: "cancelled",
    cancelledAt: now,
    cancelledBy: "system",
    cancellationReason: `refunded:${payment.id}`,
    updatedAt: now,
  });
  writeAuditLog(tx, { action: "membership.cancelled", entityType: "Membership", entityId: membership.ref.id, user, studioId: null,
    before: { status: before }, after: { status: "cancelled", reason: "payment_refunded", paymentId: payment.id } });
}

/**
 * Partial refunds are not offered for memberships (owner policy 30 Oct 2026).
 * If one arrives anyway, the membership stays exactly as it is and staff get a
 * deterministic-id alert so the policy breach is visible.
 */
export function alertMembershipPartialRefundInTx(tx: Transaction, db: Firestore, payment: Pick<Payment, "id" | "tenantId" | "studioId" | "membershipId">, now: string): void {
  const alertRef = db.collection(COLLECTIONS.staffAlerts()).doc(`membership_partial_refund_${payment.id}`);
  tx.set(alertRef, {
    id: alertRef.id, tenantId: payment.tenantId, studioId: payment.studioId ?? null,
    kind: "membership_partial_refund", paymentId: payment.id, membershipId: payment.membershipId ?? null,
    reason: "partial_membership_refund_not_offered", createdAt: now,
  });
}
