import { z } from "zod";

export const createApprovalSchema = z.object({
  jobId: z.string().min(1),
  serviceId: z.string().min(1),
  quantity: z.number().int().min(1).max(20).optional(),
  reason: z.string().min(1).max(1000).trim(),
}).strict();

export const respondToApprovalSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
}).strict();

export const cancelApprovalSchema = z.object({
  approvalId: z.string().min(1),
}).strict();

// Staff-to-admin approval requests (see packages/core types/admin-approval.ts).
// Separate from the customer additional-work approval above, which is preserved unchanged.
export const requestAdminApprovalSchema = z.object({
  targetType: z.enum(["job", "booking", "pickup_request", "none"]),
  // Required unless targetType is "none"; must be null when it is "none".
  targetId: z.string().min(1).nullish(),
  reason: z.string().trim().min(3).max(1000),
  // Context only - never applied to any job, invoice or payment.
  amountPaise: z.number().int().min(0).max(10000000).nullish(),
}).strict();

export const respondToAdminApprovalSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).nullish(),
}).strict();
