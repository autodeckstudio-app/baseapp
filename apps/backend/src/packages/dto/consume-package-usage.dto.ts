import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * `vehicleId` is the only field — per the approved product decision
 * ("any vehicle owned by that customer can use the package; each usage
 * event records which vehicle used it"), the vehicle actually being
 * serviced is legitimate client (staff) input. There is no quantity field:
 * `consumePackageUsage` (packages/domain/src/packages.ts) always consumes
 * exactly one unit per call, so there is nothing to parameterize.
 */
export const ConsumePackageUsageSchema = z.object({
  vehicleId: z.string().min(1),
});

export class ConsumePackageUsageDto extends createZodDto(ConsumePackageUsageSchema) {}
