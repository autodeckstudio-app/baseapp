import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateServiceSchema = z
  .object({
    name: z.string().min(1).optional(),
    basePrice: z.number().int().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export class UpdateServiceDto extends createZodDto(UpdateServiceSchema) {}
