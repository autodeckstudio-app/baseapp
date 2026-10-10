import { z } from "zod";

const tierEnum = z.enum(["silver", "gold", "platinum"]);

export const createMembershipPlanSchema = z.object({
  tier: tierEnum,
  name: z.string().min(1).max(100).trim(),
  priceInPaise: z.number().int().min(0),
  includedWashes: z.number().int().min(0),
  discountPercent: z.number().int().min(0).max(100),
}).strict();

// Optional fields are .nullish() not .optional(): the Firebase JS callable
// serializer encodes omitted/undefined object keys as null on the wire, so a
// client that "leaves a field out" can deliver null here (production incident
// 10 Oct 2026 - confirmMembershipPayment rejected every admin approval with
// INVALID_ARGUMENT because manualReference arrived as null).
export const updateMembershipPlanSchema = z.object({
  planId: z.string().min(1),
  name: z.string().min(1).max(100).trim().nullish(),
  priceInPaise: z.number().int().min(0).nullish(),
  includedWashes: z.number().int().min(0).nullish(),
  discountPercent: z.number().int().min(0).max(100).nullish(),
}).strict();

export const setMembershipPlanActiveSchema = z.object({
  planId: z.string().min(1),
  active: z.boolean(),
}).strict();

export const purchaseMembershipSchema = z.object({
  planId: z.string().min(1),
  method: z.enum(["razorpay_payment_link", "cash", "upi_manual", "bank_transfer"]),
  idempotencyKey: z.string().min(1).max(128),
}).strict();

export const activateMembershipSchema = z.object({
  membershipId: z.string().min(1),
}).strict();

export const cancelMembershipSchema = z.object({
  membershipId: z.string().min(1),
  reason: z.string().min(1).max(500),
}).strict();

// customerId is honored only for studio/admin callers â a customer caller's
// own uid is always used regardless of what is passed (see getMyMemberships.ts).
export const getMyMembershipsSchema = z.object({
  customerId: z.string().min(1).nullish(),
}).strict();

export const getMembershipUsageSchema = z.object({
  membershipId: z.string().min(1),
}).strict();

export const expireStaleMembershipsSchema = z.object({}).strict();

export const confirmMembershipPaymentSchema = z.object({
  membershipId: z.string().min(1),
  method: z.enum(["cash", "upi_manual", "bank_transfer"]),
  manualReference: z.string().trim().max(100).nullish(),
}).strict();

export const createWalkinMembershipSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().min(1),
  method: z.enum(["cash", "upi_manual", "bank_transfer"]),
  manualReference: z.string().trim().max(100).nullish(),
}).strict();

export type CreateMembershipPlanInput = z.infer<typeof createMembershipPlanSchema>;
export type UpdateMembershipPlanInput = z.infer<typeof updateMembershipPlanSchema>;
export type SetMembershipPlanActiveInput = z.infer<typeof setMembershipPlanActiveSchema>;
export type PurchaseMembershipInput = z.infer<typeof purchaseMembershipSchema>;
export type ActivateMembershipInput = z.infer<typeof activateMembershipSchema>;
export type CancelMembershipInput = z.infer<typeof cancelMembershipSchema>;
export type GetMyMembershipsInput = z.infer<typeof getMyMembershipsSchema>;
export type GetMembershipUsageInput = z.infer<typeof getMembershipUsageSchema>;
export type ConfirmMembershipPaymentInput = z.infer<typeof confirmMembershipPaymentSchema>;
export type CreateWalkinMembershipInput = z.infer<typeof createWalkinMembershipSchema>;
