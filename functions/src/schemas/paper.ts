import { z } from "zod";

const kind = z.enum(["RC", "INSURANCE", "PUC", "FASTAG", "OTHER"]);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

export const submitPaperSchema = z.object({
  studioId: z.string().min(1),
  vehicleId: z.string().min(1),
  kind,
  reference: z.string().min(1).max(120),
  issuedOn: dateString.optional(),
  expiresOn: dateString.optional(),
  evidenceUrl: z.string().url().max(1000).optional(),
  notes: z.string().max(300).optional(),
}).strict();

export const reviewPaperSchema = z.object({
  paperId: z.string().min(1),
  decision: z.enum(["VERIFIED", "REJECTED"]),
  rejectionReason: z.string().max(300).optional(),
}).strict();

export const updatePaperSchema = z.object({
  paperId: z.string().min(1),
  reference: z.string().min(1).max(120).optional(),
  issuedOn: dateString.nullable().optional(),
  expiresOn: dateString.nullable().optional(),
  evidenceUrl: z.string().url().max(1000).nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
}).strict();

export const listPapersSchema = z.object({
  studioId: z.string().min(1),
  vehicleId: z.string().min(1).optional(),
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
}).strict();
