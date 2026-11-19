import type { Membership, ServiceJob } from "@autodeck/core";

export type RefreshVisitState = "recorded" | "recordable" | "exhausted" | "unavailable";

/**
 * What the studio job page may offer for a membership's interior refresh
 * benefit on this visit. Recording authority itself is enforced by the
 * recordMembershipRefresh callable (studio/admin role, active non-expired
 * membership, idempotent per job); this is display logic only.
 * Lazy-expiry parity with the backend: a stale-active plan past its endDate
 * shows nothing recordable even before the sweeper runs.
 */
export function refreshVisitState(
  membership: Pick<Membership, "status" | "endDate" | "refreshesTotal" | "refreshesUsed">,
  job: Pick<ServiceJob, "status">,
  recordedRowId: string | null,
  today: string = new Date().toISOString().slice(0, 10),
): RefreshVisitState {
  const total = membership.refreshesTotal ?? 0;
  const used = membership.refreshesUsed ?? 0;
  if (total <= 0) return "unavailable";
  if (recordedRowId) return "recorded";
  // Fail closed on malformed counters (non-integer, negative, used past
  // total): the backend rejects recording on these, so the UI must never
  // offer the action on numbers it cannot verify.
  if (!Number.isInteger(total) || !Number.isInteger(used) || used < 0 || used > total)
    return "unavailable";
  if (membership.status !== "active" || !membership.endDate || membership.endDate < today)
    return "unavailable";
  if (job.status === "CANCELLED") return "unavailable";
  return used < total ? "recordable" : "exhausted";
}
