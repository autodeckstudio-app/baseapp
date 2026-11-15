import { z } from "zod";

const ratingEnum = z.enum(["good", "fair", "poor", "not_applicable"]);

export const startInspectionSchema = z.object({
  jobId: z.string().min(1),
}).strict();

export const updateInspectionSchema = z.object({
  jobId: z.string().min(1),
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        rating: ratingEnum.nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      }).strict(),
    )
    .min(1)
    .max(50)
    .optional(),
  overallNotes: z.string().max(2000).nullable().optional(),
  // Storage object paths previously issued by issueInspectionPhotoUploadUrl,
  // appended to the inspection's photo list. The server re-checks each path
  // belongs to this exact job's photo prefix before storing it, so a client
  // can never pin another job's (or another tenant's) object onto an
  // inspection. Paths only, never client-invented URLs.
  addPhotos: z.array(z.string().min(1).max(300)).min(1).max(20).optional(),
}).strict();

export const issueInspectionPhotoUploadUrlSchema = z.object({
  jobId: z.string().min(1),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
}).strict();

export const finalizeInspectionSchema = z.object({
  jobId: z.string().min(1),
}).strict();

export type StartInspectionInput = z.infer<typeof startInspectionSchema>;
export type UpdateInspectionInput = z.infer<typeof updateInspectionSchema>;
export type FinalizeInspectionInput = z.infer<typeof finalizeInspectionSchema>;
export type IssueInspectionPhotoUploadUrlInput = z.infer<typeof issueInspectionPhotoUploadUrlSchema>;
