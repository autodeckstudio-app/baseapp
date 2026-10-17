// Member free pickups. One pickup request (pickup, drop or both) uses one free pickup and its fee is waived.
// Pure, so the rule is tested without Firestore. Memberships without the fields (sold before this) have none.
import type { Membership } from "@autodeck/core";

type M = Pick<Membership, "id" | "status" | "pickupsTotal" | "pickupsUsed" | "endDate">;

export function pickupsLeft(m: Pick<M, "pickupsTotal" | "pickupsUsed">): number {
  return Math.max(0, (m.pickupsTotal ?? 0) - (m.pickupsUsed ?? 0));
}

/** The active, in-date membership with a free pickup left (the one ending soonest is used first), or null. */
export function membershipForFreePickup<T extends M>(list: T[], nowIso: string): T | null {
  const usable = list.filter((m) => m.status === "active" && pickupsLeft(m) > 0 && (!m.endDate || m.endDate >= nowIso.slice(0, 10)));
  usable.sort((a, b) => (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999"));
  return usable[0] ?? null;
}
