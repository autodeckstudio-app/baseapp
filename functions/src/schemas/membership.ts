import { z } from "zod";

const tierEnum = z.enum(["silver", "gold", "platinum"]);

export const createMembershipPlanSchema = z.object({
  tier: tierEnum,
  name: z.string().min(1).max(100).trim(),
  priceInPaise: z.number().int().min(0),
  includedWashes: z.number().int().min(0),
  discountPercent: z.number().int().min(0).max(100),
});

export const updateMembershipPlanSchema = z.object({
  planId: z.string().min(1),
  name: z.string().min(1).max(100).trim().optional(),
  priceInPaise: z.number().int().min(0).optional(),
  includedWashes: z.number().int().min(0).optional(),
  discountPercent: z.number().int().min(0).max(100).optional(),
});

export const setMembershipPlanActiveSchema = z.object({
  planId: z.string().min(1),
  active: z.boolean(),
});

export const purchaseMembershipSchema = z.object({
  planId: z.string().min(1),
  method: z.enum(["razorpay_payment_link", "cash", "upi_manual", "bank_transfer"]),
  idempotencyKey: z.string().min(1).max(128),
});

export const activateMembershipSchema = z.object({
  membershipId: z.string().min(1),
});

export const cancelMembershipSchema = z.object({
  membershipId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

// customerId is honored only for studio/admin callers — a customer caller's
// own uid is always used regardless of what is passed (see getMyMemberships.ts).
export const getMyMembershipsSchema = z.object({
  customerId: z.string().min(1).optional(),
});

export const getMembershipUsageSchema = z.object({
  membershipId: z.string().min(1),
});

export const expireStaleMembershipsSchema = z.object({});

export type CreateMembershipPlanInput = z.infer<typeof createMembershipPlanSchema>;
export type UpdateMembershipPlanInput = z.infer<typeof updateMembershipPlanSchema>;
export type SetMembershipPlanActiveInput = z.infer<typeof setMembershipPlanActiveSchema>;
export type PurchaseMembershipInput = z.infer<typeof purchaseMembershipSchema>;
export type ActivateMembershipInput = z.infer<typeof activateMembershipSchema>;
export type CancelMembershipInput = z.infer<typeof cancelMembershipSchema>;
export type GetMyMembershipsInput = z.infer<typeof getMyMembershipsSchema>;
export type GetMembershipUsageInput = z.infer<typeof getMembershipUsageSchema>;
