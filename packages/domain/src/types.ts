import { z } from 'zod';

/**
 * All money fields are integers in the smallest currency unit (paise),
 * matching the approved Firestore schema (docs review §2.1) — never a
 * floating-point rupee value.
 */

export const ServiceSchema = z.object({
  serviceId: z.string().min(1),
  name: z.string().min(1),
  basePrice: z.number().int().nonnegative(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const PriceLineItemSchema = z.object({
  serviceId: z.string().min(1),
  price: z.number().int().nonnegative(),
});
export type PriceLineItem = z.infer<typeof PriceLineItemSchema>;

export const PriceSnapshotSchema = z.object({
  lineItems: z.array(PriceLineItemSchema).min(1),
  subtotal: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  advanceRequired: z.boolean(),
  advanceAmount: z.number().int().nonnegative(),
});
export type PriceSnapshot = z.infer<typeof PriceSnapshotSchema>;

/**
 * Booking state machine, per the approved architecture (§H): Booked ->
 * InProgress -> (ApprovalRequired) -> Completed -> Sealed, with Cancelled
 * reachable only from Booked/InProgress. Sealed and Cancelled are terminal.
 */
export const BOOKING_STATUSES = [
  'booked',
  'in_progress',
  'approval_required',
  'completed',
  'sealed',
  'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
