import { z } from "zod";

const ratingEnum = z.enum(["good", "fair", "poor", "not_applicable"]);

export const startInspectionSchema = z.object({
  jobId: z.string().min(1),
});

export const updateInspectionSchema = z.object({
  jobId: z.string().min(1),
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        rating: ratingEnum.nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      }),
    )
    .min(1)
    .max(50)
    .optional(),
  overallNotes: z.string().max(2000).nullable().optional(),
});

export const finalizeInspectionSchema = z.object({
  jobId: z.string().min(1),
});

export type StartInspectionInput = z.infer<typeof startInspectionSchema>;
export type UpdateInspectionInput = z.infer<typeof updateInspectionSchema>;
export type FinalizeInspectionInput = z.infer<typeof finalizeInspectionSchema>;
