import { z } from "zod";

export const setupCustomerProfileSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
}).strict();

export const updateCustomerProfileSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  notificationPrefs: z
    .object({
      push: z.boolean(),
      quietMode: z.boolean(),
    })
    .strict()
    .optional(),
}).strict();

export type SetupCustomerProfileInput = z.infer<typeof setupCustomerProfileSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;

export const issueClaimCodeSchema = z.object({
  customerId: z.string().min(1).max(120),
}).strict();

export const claimCustomerRecordSchema = z.object({
  code: z.string().min(8).max(12),
}).strict();

export type IssueClaimCodeInput = z.infer<typeof issueClaimCodeSchema>;
export type ClaimCustomerRecordInput = z.infer<typeof claimCustomerRecordSchema>;
