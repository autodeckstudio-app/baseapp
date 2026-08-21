import { z } from "zod";

const protectionKindEnum = z.enum(["insurance", "fasttag", "puc", "rc", "extended_warranty", "other"]);
const protectionStatusEnum = z.enum(["unverified", "verified", "expired"]);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

export const createProtectionSchema = z.object({
  vehicleId: z.string().min(1),
  kind: protectionKindEnum,
  provider: z.string().min(1).max(200).optional(),
  policyNumber: z.string().min(1).max(100).optional(),
  startDate: dateStr.optional(),
  expiryDate: dateStr.optional(),
  notes: z.string().max(1000).optional(),
}).strict();

export const updateProtectionSchema = z.object({
  vehicleId: z.string().min(1),
  protectionId: z.string().min(1),
  provider: z.string().min(1).max(200).optional(),
  policyNumber: z.string().min(1).max(100).optional(),
  startDate: dateStr.optional(),
  expiryDate: dateStr.optional(),
  notes: z.string().max(1000).optional(),
  status: protectionStatusEnum.optional(),
}).strict();
