import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PERMISSION_ROLES } from '../../auth/role.type';

/**
 * `role` here is the ONLY authorization-relevant field — it becomes the
 * Firebase custom claim. `jobTitle` is plain metadata (validated for shape
 * only, never read by any guard or authorization check).
 */
export const CreateStaffSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  jobTitle: z.string().min(1),
  role: z.enum(PERMISSION_ROLES),
});

export class CreateStaffDto extends createZodDto(CreateStaffSchema) {}
