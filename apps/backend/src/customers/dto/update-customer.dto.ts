import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateCustomerSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export class UpdateCustomerDto extends createZodDto(UpdateCustomerSchema) {}
