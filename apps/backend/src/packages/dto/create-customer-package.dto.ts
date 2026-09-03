import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * No `customerId` field — it always comes from the validated
 * `:customerId` route parameter (see CustomerPackagesController), never
 * the request body. No `purchaseDate`, `expiresAt`, `totalQty`,
 * `remainingQty`, or `pricePaid` field either — all backend-derived from
 * the referenced package definition at the moment of purchase (see
 * customer-packages.service.ts).
 */
export const CreateCustomerPackageSchema = z.object({
  packageDefinitionId: z.string().min(1),
});

export class CreateCustomerPackageDto extends createZodDto(CreateCustomerPackageSchema) {}
