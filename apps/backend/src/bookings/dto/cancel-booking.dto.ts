import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * `initiatedBy` is the only field here, and it is NOT a refund amount —
 * `calculateCancellationRefund` (packages/domain/src/refundPolicy.ts) is
 * what turns this, plus the booking's own stored `scheduledAt` and
 * `priceSnapshot.advanceAmount`, into an actual refund figure. The client
 * only ever picks between two backend-defined categories; it never
 * supplies a number.
 */
export const CancelBookingSchema = z.object({
  initiatedBy: z.enum(['customer', 'studio']),
});

export class CancelBookingDto extends createZodDto(CancelBookingSchema) {}
