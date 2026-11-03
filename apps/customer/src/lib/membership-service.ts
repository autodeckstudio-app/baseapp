import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { Membership, MembershipPlan, MembershipUsage, PaymentMethod } from "@autodeck/core";

type GetMembershipPlansOutput = { plans: MembershipPlan[] };

type PurchaseMembershipInput = { planId: string; method: PaymentMethod; idempotencyKey: string };
type PurchaseMembershipOutput = { membershipId: string; paymentId: string; paymentUrl: string | null };

type GetMyMembershipsOutput = { memberships: Membership[] };

type GetMembershipUsageInput = { membershipId: string };
type GetMembershipUsageOutput = { usage: MembershipUsage[] };

export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  const fn = httpsCallable<Record<string, never>, GetMembershipPlansOutput>(
    functions,
    "getMembershipPlans",
  );
  const result = await fn({});
  return result.data.plans;
}

export async function purchaseMembership(
  planId: string,
  method: PaymentMethod,
  idempotencyKey: string,
): Promise<PurchaseMembershipOutput> {
  const fn = httpsCallable<PurchaseMembershipInput, PurchaseMembershipOutput>(
    functions,
    "purchaseMembership",
  );
  try { return (await fn({ planId, method, idempotencyKey })).data; }
  catch (error) {
    if ((error as {code?: string}).code !== "functions/already-exists") throw error;
    // A competing first request may have committed this customer's pending record.
    // Replay the same request once to read its IDs instead of showing a false failure.
    return (await fn({ planId, method, idempotencyKey })).data;
  }
}

/** Upgrade the active plan to a dearer one. The server prices it (core upgradePricePaise) and ends the old plan on payment. */
export async function upgradeMembership(planId: string, method: PaymentMethod, idempotencyKey: string): Promise<PurchaseMembershipOutput> {
  const fn = httpsCallable<PurchaseMembershipInput, PurchaseMembershipOutput>(functions, "upgradeMembership");
  try { return (await fn({ planId, method, idempotencyKey })).data; }
  catch (error) {
    if ((error as {code?: string}).code !== "functions/already-exists") throw error;
    return (await fn({ planId, method, idempotencyKey })).data;
  }
}

export async function getMyMemberships(): Promise<Membership[]> {
  const fn = httpsCallable<Record<string, never>, GetMyMembershipsOutput>(
    functions,
    "getMyMemberships",
  );
  const result = await fn({});
  return result.data.memberships;
}

export async function getMembershipUsage(membershipId: string): Promise<MembershipUsage[]> {
  const fn = httpsCallable<GetMembershipUsageInput, GetMembershipUsageOutput>(
    functions,
    "getMembershipUsage",
  );
  const result = await fn({ membershipId });
  return result.data.usage;
}

// Generates a UUID-like idempotency key on the client (matches booking-service.ts).
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
