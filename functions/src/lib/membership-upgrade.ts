import type { DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import type { Membership } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

/**
 * An upgrade is paid like any plan. When it becomes active, the plan it replaces ends in the same transaction.
 * Owner rules: unused washes are forfeited (nothing is copied across) and the new plan starts a fresh term.
 * Call readUpgradeSource BEFORE the first write of the transaction (Firestore: all reads first).
 */
export async function readUpgradeSource(tx: Transaction, db: Firestore, next: Pick<Membership, "upgradeFromMembershipId" | "customerId" | "tenantId">): Promise<{ ref: DocumentReference; data: Membership } | null> {
  if (!next.upgradeFromMembershipId) return null;
  const ref = db.collection(COLLECTIONS.memberships()).doc(next.upgradeFromMembershipId);
  const snap = await tx.get(ref);
  if (!snap.exists) return null;
  const data = snap.data() as Membership;
  if (data.status !== "active" || data.customerId !== next.customerId || data.tenantId !== next.tenantId) return null;
  return { ref, data };
}

/** Ends the replaced plan. Unused washes and pickups are not carried over. */
export function endUpgradedMembership(tx: Transaction, src: { ref: DocumentReference } | null, newMembershipId: string, nowIso: string): void {
  if (!src) return;
  tx.update(src.ref, { status: "cancelled", cancelledAt: nowIso, cancelledBy: "system", cancellationReason: `upgraded_to:${newMembershipId}`, updatedAt: nowIso });
}
