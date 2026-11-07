import type { UserRole } from "@autodeck/auth";

export type OwnerKeyKind = "canonical" | "legacy-self";
export type OwnerKey = { key: string; kind: OwnerKeyKind };

type AuthLike = {
  status: string;
  user?: { uid: string };
  claims?: { role?: UserRole };
  customerDocId?: string | null;
  customerDocResolution?: string;
};

/**
 * The owner key a customer-app list route subscribes with, distinctly typed:
 *
 * "canonical" - the resolved customer DOCUMENT id (verified authUid + tenant
 * + not-deleted). The only key a customer-role account ever uses: a claimed
 * walk-in's records live under the staged doc id, never the Auth uid, and an
 * unresolved or errored customer resolution NEVER falls back.
 *
 * "legacy-self" - staff roles only, and only after resolution returned a
 * FOUNDED absent (uid doc + persisted id + own-authUid/tenant discovery
 * query all missed; never on "error" or "claim-required"). The backend's own
 * contract: self-service is role-agnostic and staff without a profile fall
 * back to legacy uid-keyed ownership (functions createBooking.ts:50-52;
 * createVehicle defaults ownerId = user.uid). Every query stays scoped to
 * the account's own uid, so it can only surface records that name this
 * account as owner; writes are computed server-side by role.
 */
export function listOwnerKey(auth: AuthLike): OwnerKey | null {
  if (auth.status !== "ready" || !auth.user || !auth.claims) return null;
  if (auth.customerDocId) return { key: auth.customerDocId, kind: "canonical" };
  if (auth.claims.role !== "customer" && auth.customerDocResolution === "absent") {
    return { key: auth.user.uid, kind: "legacy-self" };
  }
  return null;
}
