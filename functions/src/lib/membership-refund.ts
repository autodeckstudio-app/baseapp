import type { DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import type { Booking, Membership, MembershipUsage, Payment } from "@autodeck/core";
import type { AuthorizedUser } from "@autodeck/auth";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import { writeAuditLog } from "../middleware/audit.js";

function refundSystemUser(tenantId: string): AuthorizedUser {
  return { uid: "system", displayName: "AutoDeck", email: null, claims: { role: "system", tenantId, studioId: null } } as unknown as AuthorizedUser;
}

/**
 * Owner policy (Meet, 30 Oct 2026, confirmed on the owner's own channel -
 * evidence retained outside the repo): membership refunds are always FULL, and
 * a full refund ends that membership's benefits. Partial membership refunds
 * are not offered; if one ever arrives it is money evidence only - the
 * membership is untouched and staff get an alert.
 *
 * Upgrade restoration (same owner, same day): a FULL refund of an UPGRADE
 * payment also restores the plan the upgrade replaced - only while its
 * ORIGINAL term still has days left and its own payment was never refunded.
 * The term is never extended. Washes already consumed under the refunded
 * upgrade COUNT against the restored plan (same ruling); pickup counters are
 * not carried (no owner ruling asked or given for pickups).
 *
 * Guardrails:
 *  - Only the membership the payment itself activated (payment.membershipId)
 *    plus, for an upgrade refund, the ONE predecessor it replaced are ever
 *    touched. Any OTHER membership (different payment) is never read or
 *    written here.
 *  - Booking/gift/invoice refund behavior is unchanged.
 */

/** Read the membership a refunded payment belongs to, plus any CONFIRMED pickup
 * requests still holding a free pickup from it. Call BEFORE any write in the
 * transaction (Firestore all-reads-first). */
export async function readMembershipForRefund(tx: Transaction, db: Firestore, payment: Pick<Payment, "targetType"> & { membershipId?: string | null }): Promise<{ ref: DocumentReference; data: Membership; inFlightPickupIds?: string[] } | null> {
  if (payment.targetType !== "membership" || !payment.membershipId) return null;
  const ref = db.collection(COLLECTIONS.memberships()).doc(payment.membershipId);
  const snap = await tx.get(ref);
  if (!snap.exists) return null;
  // Legacy bindings start at confirmation. Private combined reservations also
  // hold an entitlement while REQUESTED, so both open states need review alerts.
  const pickups = await tx.get(db.collection(COLLECTIONS.pickupRequests()).where("memberMembershipId", "==", ref.id).where("status", "in", ["REQUESTED","CONFIRMED"]).limit(10));
  return { ref, data: snap.data() as Membership, inFlightPickupIds: pickups.docs.map((d) => d.id) };
}

/**
 * Full refund: end the membership's benefits (active or pending both end - a
 * pending membership whose payment is refunded must never activate later).
 * Already-ended memberships (cancelled/expired) are left as they are.
 */
export function deactivateRefundedMembershipInTx(
  tx: Transaction,
  membership: { ref: DocumentReference; data: Membership; inFlightPickupIds?: string[] },
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
  // A full refund ends benefits, but a CONFIRMED pickup request holding a
  // free pickup from this plan is an obligation already in motion: it is
  // neither charged nor cancelled automatically. Staff get a deterministic
  // alert, and the pickup update path refuses to complete it free (see
  // pickupRequests.ts) so a person decides how to settle it.
  if (membership.inFlightPickupIds && membership.inFlightPickupIds.length > 0) {
    const alertRef = membership.ref.firestore.collection(COLLECTIONS.staffAlerts()).doc(`membership_refund_inflight_pickup_${membership.ref.id}`);
    tx.set(alertRef, {
      id: alertRef.id, tenantId: membership.data.tenantId, studioId: null,
      kind: "membership_refund_inflight_pickup", membershipId: membership.ref.id, paymentId: payment.id,
      requestIds: membership.inFlightPickupIds,
      reason: "refund_ends_benefits_but_pickup_in_flight", createdAt: now,
    });
  }
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

/**
 * Evidence about the plan an upgrade replaced - every read here runs BEFORE
 * any write in the caller's transaction (Firestore all-reads-first).
 */
export interface UpgradePredecessorEvidence {
  kind: "none" | "missing" | "found";
  id?: string;
  ref?: DocumentReference;
  data?: Membership;
  /** The completed payment behind the predecessor, when one exists. */
  activatingPayment?: Payment | null;
  /** The predecessor has at least one payment record at all. */
  hasAnyPayment?: boolean;
  /** A full refund signal on any predecessor payment (status refunded or refundAmount covers the amount). */
  fullRefundSignal?: boolean;
  /** A partial refund signal on any predecessor payment. */
  partialRefundSignal?: boolean;
  /** Another pending/active membership exists for this customer (in-tx query or the purchase claim doc). */
  otherPlanInFlight?: boolean;
  /** Open (non-terminal) wash-covered bookings pointing at the refunded membership, each with its usage records. */
  openWashBookings?: Array<{ ref: DocumentReference; usage: Array<{ ref: DocumentReference; data: MembershipUsage }> }>;
  /** True when the open-bookings read hit its limit - restoring would repoint only SOME bookings, so it must alert instead. */
  tooManyOpenBookings?: boolean;
}

export async function readUpgradePredecessorForRefund(
  tx: Transaction,
  db: Firestore,
  membership: { ref: DocumentReference; data: Membership } | null,
): Promise<UpgradePredecessorEvidence> {
  if (!membership) return { kind: "none" };
  const fromId = membership.data.upgradeFromMembershipId;
  if (!fromId) return { kind: "none" };
  const ref = db.collection(COLLECTIONS.memberships()).doc(fromId);
  const snap = await tx.get(ref);
  if (!snap.exists) return { kind: "missing", id: fromId };
  const data = snap.data() as Membership;
  const paySnap = await tx.get(db.collection(COLLECTIONS.payments()).where("membershipId", "==", fromId).limit(5));
  const payments = paySnap.docs.map((d) => d.data() as Payment);
  // A payment that ever completed: refunds (full or partial) only exist on a
  // completed payment, so partially_refunded still proves the plan was paid.
  const activatingPayment = payments.find((p) => p.status === "completed" || p.status === "partially_refunded") ?? null;
  const fullRefundSignal = payments.some((p) => p.status === "refunded" || (p.refundAmount ?? 0) >= p.amount);
  const partialRefundSignal = payments.some((p) => p.status !== "refunded" && (p.refundAmount ?? 0) > 0);
  // Another pending/active plan for the SAME customer - restoring on top of it
  // would hand the customer two live plans. The refunded membership itself is
  // excluded (it can still read active in this pre-write phase); the cancelled
  // predecessor cannot match the status filter.
  const othersSnap = await tx.get(
    db
      .collection(COLLECTIONS.memberships())
      .where("tenantId", "==", membership.data.tenantId)
      .where("customerId", "==", membership.data.customerId)
      .where("status", "in", ["pending", "active"])
      .limit(5),
  );
  let otherPlanInFlight = othersSnap.docs.some((d) => d.id !== membership.ref.id);
  // Phantom-safe half of the same check: purchaseMembership writes the
  // per-customer claim doc inside its transaction, so reading it here makes a
  // concurrent purchase conflict-and-retry instead of racing the restore.
  // (upgradeMembership/createWalkinMembership predate the claim doc and do not
  // write it. The query above is the ONLY cover for those paths and it cannot
  // see a plan committed after it runs - no shared document means no conflict,
  // proven by the RESIDUAL concurrency test in membership-refund-policy. That
  // race stays open until those transactions also write the claim doc.)
  const claimRef = db.collection("membershipClaims").doc(`${membership.data.tenantId}_${membership.data.customerId}`);
  const claimSnap = await tx.get(claimRef);
  if (claimSnap.exists) {
    const heldId = (claimSnap.data() as { membershipId?: string }).membershipId;
    if (heldId && heldId !== membership.ref.id && heldId !== fromId) {
      const heldSnap = await tx.get(db.collection(COLLECTIONS.memberships()).doc(heldId));
      const heldStatus = heldSnap.exists ? (heldSnap.data() as Membership).status : null;
      if (heldStatus === "pending" || heldStatus === "active") otherPlanInFlight = true;
    }
  }
  // Open wash-covered bookings under the refunded membership: they move to
  // the restored plan with their usage records, so a later cancellation
  // restores the wash credit on the LIVE plan instead of a dead one.
  const bkSnap = await tx.get(
    db.collection(COLLECTIONS.bookings()).where("membershipId", "==", membership.ref.id).where("membershipWashUsed", "==", true).limit(25),
  );
  const openWashBookings: Array<{ ref: DocumentReference; usage: Array<{ ref: DocumentReference; data: MembershipUsage }> }> = [];
  for (const d of bkSnap.docs) {
    const bkg = d.data() as Booking;
    if (bkg.status === "COMPLETED" || bkg.status === "CANCELLED" || bkg.status === "EXPIRED") continue;
    const uSnap = await tx.get(db.collection(SUBCOLLECTIONS.membershipUsage(membership.ref.id)).where("bookingId", "==", d.id).limit(5));
    openWashBookings.push({ ref: d.ref, usage: uSnap.docs.map((u) => ({ ref: u.ref, data: u.data() as MembershipUsage })) });
  }
  // In practice open wash-covered bookings cannot exceed the plan's
  // washesTotal (a credit is consumed per booking), so 25 is unreachable
  // headroom; hitting the limit means something is off - fail closed.
  return { kind: "found", id: fromId, ref, data, activatingPayment, hasAnyPayment: payments.length > 0, fullRefundSignal, partialRefundSignal, otherPlanInFlight, openWashBookings, tooManyOpenBookings: bkSnap.docs.length >= 25 };
}

export type UpgradeRestoreOutcome =
  | "restored"
  | "not_an_upgrade"
  // Clear ineligibility - silent, the refund itself still projects:
  | "skip_expired" // the original term is already over; nothing left to give back
  | "skip_already_refunded" // the predecessor's own money already went back (full)
  | "skip_not_ended_by_upgrade" // the customer/staff ended it themselves
  // Uncertain evidence - restore nothing, alert staff with a deterministic doc:
  | "alert_predecessor_missing"
  | "alert_chain_anomaly" // active/pending, or cancelled by a DIFFERENT upgrade chain
  | "alert_ownership_drift" // tenant/customer mismatch on the membership or its payment
  | "alert_payment_missing" // no payment record at all behind an active-then-upgraded plan
  | "alert_payment_unpaid" // payments exist but none ever completed
  | "alert_payment_partial" // partial refund signal on the predecessor's payment
  | "alert_other_plan_in_flight" // another pending/active plan exists for this customer
  | "alert_too_many_open_bookings"; // open wash bookings hit the read limit - never repoint partially

function alertMembershipRestoreUncertainInTx(
  tx: Transaction,
  db: Firestore,
  payment: Pick<Payment, "id" | "tenantId" | "studioId">,
  refundedMembershipId: string,
  predecessorMembershipId: string | null,
  reason: UpgradeRestoreOutcome,
  now: string,
): void {
  const alertRef = db.collection(COLLECTIONS.staffAlerts()).doc(`membership_restore_uncertain_${payment.id}`);
  tx.set(alertRef, {
    id: alertRef.id, tenantId: payment.tenantId, studioId: payment.studioId ?? null,
    kind: "membership_restore_uncertain", paymentId: payment.id,
    membershipId: refundedMembershipId, predecessorMembershipId,
    reason, createdAt: now,
  });
}

/**
 * Restore the plan an upgrade replaced after the upgrade payment is FULLY
 * refunded (owner approval 30 Oct 2026, evidence retained outside the repo).
 * Every guard must hold. Clear ineligibility (term over, own money already
 * refunded, ended by the customer) skips silently; UNCERTAIN evidence
 * (missing/unpaid/mismatched payment, chain or ownership drift, another live
 * plan) restores nothing and raises a deterministic staff alert instead -
 * the refund itself always projects either way.
 * On restore the per-customer purchase claim doc is moved to the restored
 * plan so a concurrent purchase conflicts and retries instead of double-
 * activating. Counters (owner ruling 30 Oct 2026): washes consumed under
 * the refunded upgrade count against the restored plan - the successor's NET
 * washesUsed (cancellations already netted out) is added to the
 * predecessor's counter, UNCAPPED (true net: no credit can ever be minted
 * from capped-away overflow); OPEN wash-covered
 * bookings move to the restored plan with their usage records, so a later
 * cancellation restores the credit on the live plan and a completed job
 * keeps it counted. Pickup counters are NOT carried (no ruling).
 * Idempotent: after a restore the
 * predecessor is active with no `upgraded_to:` reason, so a redelivery or a
 * converged rerun fails the first guard and writes nothing.
 */
export function restoreUpgradedPredecessorInTx(
  tx: Transaction,
  db: Firestore,
  ev: UpgradePredecessorEvidence,
  refundedMembership: { id: string; tenantId: string; customerId: string; washesUsed: number },
  payment: Pick<Payment, "id" | "tenantId" | "studioId">,
  now: string,
): UpgradeRestoreOutcome {
  if (ev.kind === "none") return "not_an_upgrade";
  if (ev.kind === "missing") {
    alertMembershipRestoreUncertainInTx(tx, db, payment, refundedMembership.id, ev.id ?? null, "alert_predecessor_missing", now);
    return "alert_predecessor_missing";
  }
  const ref = ev.ref!;
  const data = ev.data!;
  const fail = (reason: UpgradeRestoreOutcome): UpgradeRestoreOutcome => {
    alertMembershipRestoreUncertainInTx(tx, db, payment, refundedMembership.id, ref.id, reason, now);
    return reason;
  };
  const expected = `upgraded_to:${refundedMembership.id}`;
  const reason = data.cancellationReason ?? "";
  if (data.status === "cancelled" && reason.startsWith("refunded:")) return "skip_already_refunded";
  if (data.status === "cancelled" && reason && !reason.startsWith("upgraded_to:")) return "skip_not_ended_by_upgrade";
  if (data.status !== "cancelled" || reason !== expected) {
    if (data.status === "expired") return "skip_expired";
    return fail("alert_chain_anomaly");
  }
  if (ev.fullRefundSignal) return "skip_already_refunded";
  if (!data.endDate || data.endDate < now.slice(0, 10)) return "skip_expired";
  if (data.tenantId !== refundedMembership.tenantId || data.customerId !== refundedMembership.customerId) {
    return fail("alert_ownership_drift");
  }
  if (!ev.hasAnyPayment) return fail("alert_payment_missing");
  if (!ev.activatingPayment) return fail("alert_payment_unpaid");
  if (ev.activatingPayment.tenantId !== refundedMembership.tenantId || ev.activatingPayment.customerId !== refundedMembership.customerId) {
    return fail("alert_ownership_drift");
  }
  if (ev.partialRefundSignal) return fail("alert_payment_partial");
  if (ev.otherPlanInFlight) return fail("alert_other_plan_in_flight");
  if (ev.tooManyOpenBookings) return fail("alert_too_many_open_bookings");
  const user = refundSystemUser(data.tenantId);
  // Washes consumed under the refunded upgrade count against the restored
  // plan (owner ruling 30 Oct 2026). The counter is the TRUE NET consumption,
  // deliberately NOT capped at the plan total: consumption is gated by
  // washesUsed < washesTotal, so an over-total counter simply means "no
  // credits", and a later cancellation of a transferred booking decrements
  // real use - it can never mint a credit out of capped-away overflow.
  // Pickups deliberately untouched (no ruling).
  const carriedWashes = (data.washesUsed ?? 0) + (refundedMembership.washesUsed ?? 0);
  for (const ob of ev.openWashBookings ?? []) {
    tx.update(ob.ref, { membershipId: ref.id, updatedAt: now });
    for (const u of ob.usage) {
      tx.set(db.collection(SUBCOLLECTIONS.membershipUsage(ref.id)).doc(u.ref.id), { ...u.data, membershipId: ref.id });
      tx.delete(u.ref);
    }
  }
  tx.update(ref, {
    status: "active",
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    restoredAt: now,
    restoredBy: "system",
    washesUsed: carriedWashes,
    updatedAt: now,
  });
  // Move the per-customer purchase claim to the restored plan: a concurrent
  // purchase now conflicts on this doc and retries into already-exists.
  tx.set(db.collection("membershipClaims").doc(`${data.tenantId}_${data.customerId}`), {
    tenantId: data.tenantId, customerId: data.customerId, membershipId: ref.id, updatedAt: now,
  });
  writeAuditLog(tx, { action: "membership.restored", entityType: "Membership", entityId: ref.id, user, studioId: null,
    before: { status: "cancelled", cancellationReason: expected },
    after: { status: "active", reason: "upgrade_refunded", paymentId: payment.id, endDate: data.endDate, washesCarried: refundedMembership.washesUsed ?? 0, washesUsed: carriedWashes } });
  return "restored";
}
