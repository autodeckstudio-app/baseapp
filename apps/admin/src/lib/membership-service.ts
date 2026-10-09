"use client";

import { httpsCallable } from "firebase/functions";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import type { Customer, Membership, MembershipPlan, MembershipTier, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

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

// ---- Pending payment queue + walk-in sales (FIX8) ----

export interface PendingMembershipRow {
  membership: Membership;
  payment: Payment | null;
  customerName: string;
  customerPhone: string;
  planName: string;
}

/** Pending (unpaid) membership purchase requests for the tenant, newest first. */
export async function listPendingMemberships(tenantId: string): Promise<PendingMembershipRow[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.memberships()), where("tenantId", "==", tenantId), where("status", "==", "pending")),
  );
  const rows: PendingMembershipRow[] = [];
  for (const d of snap.docs) {
    const membership = d.data() as Membership;
    const [paySnap, custSnap, planSnap] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.payments()), where("membershipId", "==", membership.id))),
      getDoc(doc(db, COLLECTIONS.customers(), membership.customerId)),
      getDoc(doc(db, COLLECTIONS.membershipPlans(), membership.planId)),
    ]);
    const payment = paySnap.docs.map((p) => p.data() as Payment).find((p) => p.status === "pending" || p.status === "processing") ?? paySnap.docs[0]?.data() as Payment | null ?? null;
    const customer = custSnap.exists() ? (custSnap.data() as Customer) : null;
    const plan = planSnap.exists() ? (planSnap.data() as MembershipPlan) : null;
    rows.push({
      membership,
      payment,
      customerName: customer?.name ?? "Unknown customer",
      customerPhone: customer?.phone ?? "",
      planName: plan?.name ?? membership.tier,
    });
  }
  return rows.sort((a, b) => b.membership.createdAt.localeCompare(a.membership.createdAt));
}

export async function confirmMembershipPayment(input: { membershipId: string; method: "cash" | "upi_manual" | "bank_transfer"; manualReference?: string | undefined }): Promise<void> {
  const fn = httpsCallable(functions, "confirmMembershipPayment");
  await fn(input);
}

export async function createWalkinMembership(input: { customerId: string; planId: string; method: "cash" | "upi_manual" | "bank_transfer"; manualReference?: string | undefined }): Promise<{ membershipId: string; paymentId: string }> {
  const fn = httpsCallable<typeof input, { membershipId: string; paymentId: string }>(functions, "createWalkinMembership");
  const result = await fn(input);
  return result.data;
}

/** Normalize an Indian mobile entry to the stored "+91..." form. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^0-9]/g, "");
  return `+91${digits.slice(-10)}`;
}

export async function findCustomerByPhone(tenantId: string, phone: string): Promise<Customer | null> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.customers()), where("tenantId", "==", tenantId), where("phone", "==", phone)),
  );
  const d = snap.docs[0];
  return d && !(d.data() as Customer).deletedAt ? (d.data() as Customer) : null;
}

export async function createWalkinCustomer(input: { name: string; email: string; phone?: string }): Promise<{ customer: Customer; created: boolean }> {
  const fn = httpsCallable<typeof input, { customer: Customer; created: boolean }>(functions, "createWalkinCustomer");
  const result = await fn(input);
  return result.data;
}
