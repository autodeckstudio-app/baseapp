import type { Membership, ServiceJob } from "@autodeck/core";

export type RefreshVisitState = "recorded" | "recordable" | "exhausted" | "unavailable";

/**
 * What the studio job page may offer for a membership's interior refresh
 * benefit on this visit. Recording authority itself is enforced by the
 * recordMembershipRefresh callable (studio/admin role, active non-expired
 * membership, idempotent per job); this is display logic only.
 */
export function refreshVisitState(
  membership: Pick<Membership, "status" | "refreshesTotal" | "refreshesUsed">,
  job: Pick<ServiceJob, "status">,
  recordedRowId: string | null,
): RefreshVisitState {
  const total = membership.refreshesTotal ?? 0;
  const used = membership.refreshesUsed ?? 0;
  if (total <= 0) return "unavailable";
  if (recordedRowId) return "recorded";
  if (membership.status !== "active" || job.status === "CANCELLED") return "unavailable";
  return used < total ? "recordable" : "exhausted";
}
