import { z } from 'zod';

/**
 * Backend-managed customer profile. `customerId` is always server-generated
 * (see CustomersService) — never client-supplied — matching how `staffId` is
 * always the Firebase Auth uid assigned by the backend, never chosen by a
 * caller.
 */
export const CustomerSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
});
export type Customer = z.infer<typeof CustomerSchema>;
