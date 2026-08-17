import { z } from "zod";

export const setupCustomerProfileSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
});

export const updateCustomerProfileSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  notificationPrefs: z
    .object({
      push: z.boolean(),
      quietMode: z.boolean(),
    })
    .optional(),
});

export type SetupCustomerProfileInput = z.infer<typeof setupCustomerProfileSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
