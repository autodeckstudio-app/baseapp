import { z } from "zod";

// Staff roles assignable through the admin app. "superadmin" is platform-level
// and is never granted through this flow.
const staffRoleEnum = z.enum(["studio", "admin"]);

export const addStaffMemberSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().trim(),
  password: z.string().min(8).max(128),
  phone: z.string().max(20).trim().optional(),
  role: staffRoleEnum,
  studioId: z.string().min(1).nullable(),
}).strict();

export const updateStaffRoleSchema = z.object({
  employeeId: z.string().min(1),
  role: staffRoleEnum,
  studioId: z.string().min(1).nullable(),
}).strict();

export const deactivateStaffMemberSchema = z.object({
  employeeId: z.string().min(1),
}).strict();

export type AddStaffMemberInput = z.infer<typeof addStaffMemberSchema>;
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;
export type DeactivateStaffMemberInput = z.infer<typeof deactivateStaffMemberSchema>;
