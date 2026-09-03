import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** No `ownerCustomerId` field — vehicle ownership can never be reassigned via this endpoint. */
export const UpdateVehicleSchema = z
  .object({
    make: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    plate: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export class UpdateVehicleDto extends createZodDto(UpdateVehicleSchema) {}
