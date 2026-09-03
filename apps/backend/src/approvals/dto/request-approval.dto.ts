import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * No `visitId`, `bookingId`, `customerId`, `approvalId`, or `decision`
 * field — identity comes only from the validated `:visitId` route
 * parameter (see ApprovalsController), and `decision` always starts
 * `'pending'`, set by ApprovalsService, never by the client.
 * `additionalAmount` mirrors the exact same constraint as the pre-existing
 * `ServiceSchema.basePrice` (`z.number().int().nonnegative()`) — an integer
 * number of paise.
 */
export const RequestApprovalSchema = z.object({
  description: z.string().min(1),
  additionalAmount: z.number().int().nonnegative(),
});

export class RequestApprovalDto extends createZodDto(RequestApprovalSchema) {}
