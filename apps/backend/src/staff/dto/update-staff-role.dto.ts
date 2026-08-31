import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PERMISSION_ROLES } from '../../auth/role.type';

export const UpdateStaffRoleSchema = z.object({
  role: z.enum(PERMISSION_ROLES),
});

export class UpdateStaffRoleDto extends createZodDto(UpdateStaffRoleSchema) {}
