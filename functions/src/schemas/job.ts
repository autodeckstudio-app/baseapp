import { z } from "zod";

const vehicleCategoryEnum = z.enum([
  "hatchback",
  "sedan",
  "suv",
  "luxury",
  "commercial",
  "van",
]);

export const createWalkinJobSchema = z.object({
  serviceId: z.string().min(1),
  vehicleId: z.string().min(1),
  vehicleCategory: vehicleCategoryEnum,
  bayId: z.string().min(1),
  customerId: z.string().min(1),
  studioId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export const advanceJobStatusSchema = z.object({
  jobId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export const getStudioJobsSchema = z.object({
  studioId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
});

export const assignBaySchema = z.object({
  jobId: z.string().min(1),
  bayId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export type CreateWalkinJobInput = z.infer<typeof createWalkinJobSchema>;
export type AdvanceJobStatusInput = z.infer<typeof advanceJobStatusSchema>;
export type GetStudioJobsInput = z.infer<typeof getStudioJobsSchema>;
export type AssignBayInput = z.infer<typeof assignBaySchema>;
