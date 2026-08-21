import { z } from "zod";

// India plate format: up to 2 letters + 2 digits + 1-2 letters + 4 digits
// e.g. GJ01AB1234 or MH12DE3456
// Tenant-configurable regex — this is the default India format
const INDIA_PLATE_REGEX = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/;

const vehicleCategorySchema = z.enum([
  "hatchback",
  "sedan",
  "suv",
  "luxury",
  "commercial",
  "van",
]);

export const createVehicleSchema = z.object({
  registrationNumber: z
    .string()
    .toUpperCase()
    .regex(INDIA_PLATE_REGEX, "Invalid India vehicle registration format (e.g. GJ01AB1234)"),
  make: z.string().min(1).max(50).trim(),
  model: z.string().min(1).max(100).trim(),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
  color: z.string().min(1).max(50).trim(),
  category: vehicleCategorySchema.nullable().optional(),
  // Studio/admin walk-in registration only — a customer can never set this
  // (enforced in the handler, not just by convention); ignored for role
  // 'customer', who always owns the vehicle they create.
  ownerId: z.string().min(1).optional(),
}).strict();

export const updateVehicleSchema = z.object({
  vehicleId: z.string().min(1),
  registrationNumber: z
    .string()
    .toUpperCase()
    .regex(INDIA_PLATE_REGEX)
    .optional(),
  make: z.string().min(1).max(50).trim().optional(),
  model: z.string().min(1).max(100).trim().optional(),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),
  color: z.string().min(1).max(50).trim().optional(),
  odometer: z.number().int().min(0).optional(),
  category: vehicleCategorySchema.nullable().optional(),
}).strict();

export const archiveVehicleSchema = z.object({
  vehicleId: z.string().min(1),
}).strict();

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ArchiveVehicleInput = z.infer<typeof archiveVehicleSchema>;
