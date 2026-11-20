import { membershipDay } from "@autodeck/core";
// Membership wash: one included wash per booking. This file only decides whether the wash MAY be offered.
// The price and the decrement of the plan count are the server's job (createBooking), never the app's.
import type { Membership, Service } from "@autodeck/core";

/**
 * Live since 17 Oct: createBooking (deployed) re-checks every rule, prices the wash at zero and decrements the plan
 * in one transaction; cancelBooking gives the wash back. The app only sends the membership id.
 */
export const MEMBERSHIP_WASH_LIVE = true;

export type WashDecision =
  | { ok: true; membershipId: string; washesLeft: number; expiresOn: string | null }
  | { ok: false; reason: "no_membership" | "not_active" | "not_started" | "expired" | "no_washes_left" | "service_not_eligible" | "already_applied" };

type M = Pick<Membership, "id" | "status" | "washesTotal" | "washesUsed" | "startDate" | "endDate" | "washServiceIds">;
type S = Pick<Service, "membershipWashEligible"> & { id?: string };

/**
 * Whether a membership's included washes cover this service. Mirrors the server rule exactly
 * (functions membership-eligibility): when the membership carries a washServiceIds snapshot,
 * the snapshot alone decides, so a purchased entitlement stays stable under later global flag
 * edits; when it is missing (memberships bought before plan-level binding existed), the global
 * Service.membershipWashEligible flag decides, unchanged. Never offer a wash this rejects:
 * the server would refuse it at booking.
 */
export function membershipCoversWashService(service: S, membership: Pick<Membership, "washServiceIds">): boolean {
  if (membership.washServiceIds !== undefined) {
    return service.id !== undefined && membership.washServiceIds.includes(service.id);
  }
  return service.membershipWashEligible === true;
}

/** Calendar date (YYYY-MM-DD) in the studio's timezone, so a plan ending today is still valid today. */
export function todayInIndia(now = new Date()): string {
  return membershipDay(now);
}

export function evaluateWash(input: { membership: M | null | undefined; service: S | null | undefined; today: string; alreadyApplied?: boolean }): WashDecision {
  const { membership: m, service, today } = input;
  if (!m) return { ok: false, reason: "no_membership" };
  if (input.alreadyApplied) return { ok: false, reason: "already_applied" };
  if (!service || !membershipCoversWashService(service, m)) return { ok: false, reason: "service_not_eligible" };
  if (m.status !== "active") return { ok: false, reason: "not_active" };
  if (m.startDate && m.startDate.slice(0, 10) > today) return { ok: false, reason: "not_started" };
  if (m.endDate && m.endDate.slice(0, 10) < today) return { ok: false, reason: "expired" };
  const left = m.washesTotal - m.washesUsed;
  if (!(left > 0)) return { ok: false, reason: "no_washes_left" };
  return { ok: true, membershipId: m.id, washesLeft: left, expiresOn: m.endDate ? m.endDate.slice(0, 10) : null };
}

/** The usable plan with the most washes left, or the first reason none worked. */
export function pickWash(list: M[], service: S | null | undefined, today: string, alreadyApplied = false): WashDecision {
  let best: WashDecision | null = null;
  let firstFail: WashDecision = { ok: false, reason: "no_membership" };
  list.forEach((m, i) => {
    const d = evaluateWash({ membership: m, service, today, alreadyApplied });
    if (d.ok) { if (!best || (best.ok && d.washesLeft > best.washesLeft)) best = d; }
    else if (i === 0) firstFail = d;
  });
  return best ?? firstFail;
}
