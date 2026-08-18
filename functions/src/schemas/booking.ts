import { z } from "zod";

const vehicleCategoryEnum = z.enum([
  "hatchback",
  "sedan",
  "suv",
  "luxury",
  "commercial",
  "van",
]);

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm");

export const getAvailabilitySchema = z.object({
  serviceId: z.string().min(1),
  studioId: z.string().min(1),
  startDate: dateStr,
  lookAheadDays: z.number().int().min(1).max(30).optional(),
});

export const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  vehicleId: z.string().min(1),
  vehicleCategory: vehicleCategoryEnum,
  studioId: z.string().min(1),
  scheduledDate: dateStr,
  scheduledTime: timeStr,
  idempotencyKey: z.string().min(1).max(128),
  notes: z.string().max(500).optional(),
  membershipId: z.string().min(1).optional(),
});

export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export const rescheduleBookingSchema = z.object({
  bookingId: z.string().min(1),
  newDate: dateStr,
  newTime: timeStr,
  idempotencyKey: z.string().min(1).max(128),
});

export type GetAvailabilityInput = z.infer<typeof getAvailabilitySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
