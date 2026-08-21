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
