"use client";

import { httpsCallable } from "firebase/functions";
import type { Membership, MembershipPlan, MembershipTier } from "@autodeck/core";
import { functions } from "./firebase";

export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  const fn = httpsCallable<Record<string, never>, { plans: MembershipPlan[] }>(
    functions,
    "getMembershipPlans",
  );
  const result = await fn({});
  return result.data.plans;
}

export interface CreateMembershipPlanInput {
  tier: MembershipTier;
  name: string;
  priceInPaise: number;
  includedWashes: number;
  discountPercent: number;
}

export async function createMembershipPlan(input: CreateMembershipPlanInput): Promise<MembershipPlan> {
  const fn = httpsCallable<CreateMembershipPlanInput, { plan: MembershipPlan }>(
    functions,
    "createMembershipPlan",
  );
  const result = await fn(input);
  return result.data.plan;
}

export type UpdateMembershipPlanInput = Partial<Omit<CreateMembershipPlanInput, "tier">> & {
  planId: string;
};

export async function updateMembershipPlan(input: UpdateMembershipPlanInput): Promise<void> {
  const fn = httpsCallable(functions, "updateMembershipPlan");
  await fn(input);
}

export async function setMembershipPlanActive(planId: string, active: boolean): Promise<void> {
  const fn = httpsCallable(functions, "setMembershipPlanActive");
  await fn({ planId, active });
}

export async function activateMembership(membershipId: string): Promise<void> {
  const fn = httpsCallable(functions, "activateMembership");
  await fn({ membershipId });
}

export async function cancelMembership(membershipId: string, reason: string): Promise<void> {
  const fn = httpsCallable(functions, "cancelMembership");
  await fn({ membershipId, reason });
}

// Admin-wide membership list is not yet exposed by a dedicated Cloud Function
// (getMyMemberships is scoped per-customer); pending-activation memberships
// are looked up per customer from the Customer 360 view in a later phase.
export async function getCustomerMemberships(customerId: string): Promise<Membership[]> {
  const fn = httpsCallable<{ customerId: string }, { memberships: Membership[] }>(
    functions,
    "getMyMemberships",
  );
  const result = await fn({ customerId });
  return result.data.memberships;
}
