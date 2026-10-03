import { z } from "zod";

const contentType = z.enum(["image/jpeg", "image/png", "image/webp"]);
const fields = {
  make: z.string().min(1).max(50).trim(),
  model: z.string().min(1).max(80).trim(),
  variant: z.string().max(80).trim().nullable().optional(),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  kmDriven: z.number().int().min(0).max(1_500_000),
  fuel: z.enum(["petrol", "diesel", "cng", "electric", "hybrid"]),
  gearbox: z.enum(["manual", "automatic"]),
  owners: z.number().int().min(1).max(10),
  colour: z.string().min(1).max(40).trim(),
  area: z.string().min(1).max(60).trim(),
  askingPrice: z.number().int().min(100_000).max(100_000_000_00), // paise
  description: z.string().max(1000).nullable().optional(),
  insuranceValidTill: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  photoPaths: z.array(z.string().max(300)).min(1).max(12),
};

// No links or phone-like numbers in public text: enquiries go through the studio.
export const noContactInText = (s: string | null | undefined): boolean => !s || !/(https?:\/\/|www\.|\d[\d\s-]{8,}\d)/i.test(s);

export const issueListingPhotoUploadUrlSchema = z.object({ contentType }).strict();

export const adminSaveListingSchema = z.object({
  listingId: z.string().min(1).optional(),
  status: z.enum(["draft", "live", "reserved", "sold"]),
  ...fields,
  sellerName: z.string().max(80).nullable().optional(),
  sellerPhone: z.string().max(20).nullable().optional(),
  registrationNumber: z.string().max(15).nullable().optional(),
  reservePrice: z.number().int().min(0).nullable().optional(),
  adminNotes: z.string().max(500).nullable().optional(),
}).strict();

export const submitMyListingSchema = z.object({
  listingId: z.string().min(1).optional(), // edit own listing (goes back to pending)
  ...fields,
  sellerName: z.string().min(1).max(80).trim(),
  sellerPhone: z.string().min(10).max(15).trim(),
  registrationNumber: z.string().max(15).nullable().optional(),
}).strict();

export const reviewListingSchema = z.object({
  listingId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(300).optional(),
}).strict();

export const listCarListingsSchema = z.object({ includeAll: z.boolean().optional(), mine: z.boolean().optional() }).strict();

export const expressInterestSchema = z.object({
  listingId: z.string().min(1),
  kind: z.enum(["interest", "report"]),
  phone: z.string().min(10).max(15).optional(),
  note: z.string().max(300).optional(),
}).strict();

export const setLeadStatusSchema = z.object({ leadId: z.string().min(1), status: z.enum(["new", "contacted", "closed"]) }).strict();
export const listCarLeadsSchema = z.object({}).strict();
