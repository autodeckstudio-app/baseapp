import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * `approved` is a boolean flag, not a state value or a refund/price amount
 * — staff records a real-world outcome (the customer said yes or no) that
 * ApprovalsService then maps onto the one legal domain transition out of
 * `approval_required` (see approvals.service.ts). There is no field here
 * that lets a client set `decision`, `status`, or any amount directly.
 */
export const ResolveApprovalSchema = z.object({
  approved: z.boolean(),
});

export class ResolveApprovalDto extends createZodDto(ResolveApprovalSchema) {}
