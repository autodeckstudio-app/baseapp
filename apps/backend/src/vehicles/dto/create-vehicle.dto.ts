import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Deliberately has no `ownerCustomerId` field. Ownership is always the
 * `:customerId` route parameter of `POST /customers/:customerId/vehicles`,
 * validated server-side against an existing customer record in
 * VehiclesService — never a value read from the request body. Even if a
 * client includes `ownerCustomerId` in the body, Zod's default object
 * behavior strips unrecognized keys, so it never reaches the controller or
 * service at all.
 */
export const CreateVehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  plate: z.string().min(1),
});

export class CreateVehicleDto extends createZodDto(CreateVehicleSchema) {}
