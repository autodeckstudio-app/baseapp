import { z } from "zod";

const vehicleCategoryEnum = z.enum([
  "hatchback",
  "sedan",
  "suv",
  "luxury",
  "commercial",
  "van",
]);

const serviceCategoryEnum = z.enum([
  "ppf",
  "ceramic",
  "washing",
  "coating",
  "inspection",
  "tinting",
  "other",
]);

const bayTypeEnum = z.enum(["wash", "protection", "general"]);
const warrantyDurationUnitEnum = z.enum(["days", "months", "years", "lifetime"]);

export const vehicleCategoryPricingSchema = z.object({
  vehicleCategory: vehicleCategoryEnum,
  additionalPricePaise: z.number().int().min(0, "Price must be non-negative paise"),
  additionalMinutes: z.number().int().min(0),
}).strict();

export const createServiceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  category: serviceCategoryEnum,
  brand: z.string().max(100).trim().nullable(),
  description: z.string().min(1).max(2000).trim(),
  basePrice: z.number().int().min(0, "Base price must be a non-negative integer (paise)"),
  currency: z.string().length(3).optional(),
  // Cap raised from 1440 (1 day) to 20160 (2 weeks) in Phase 4: the real
  // AutoModz PPF catalogue includes genuine multi-day jobs (up to 4320 min /
  // 3 days — LLumar Valor). NOTE: raising this only makes the duration
  // storable; the customer-facing availability/slot-generation engine
  // (generateDaySlots in lib/availability.ts) still requires a job to fit
  // within a single day's operating-hours window, so multi-day services
  // currently show zero bookable slots online — see Phase 4 HANDOFF. Walk-in
  // registration is unaffected (its bay-conflict check is duration-agnostic).
  estimatedDurationMinutes: z.number().int().min(1).max(20160),
  warrantyLabel: z.string().max(200).trim().nullable(),
  // Optional: existing callers (e.g. the current admin catalogue form) don't
  // send these yet — omitted means unconfigured (null), never guessed.
  warrantyDurationValue: z.number().int().min(1).nullable().optional(),
  warrantyDurationUnit: warrantyDurationUnitEnum.nullable().optional(),
  vehicleCategoryPricing: z.array(vehicleCategoryPricingSchema).optional(),
  requiredBayType: bayTypeEnum.optional(),
  membershipWashEligible: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
}).strict();

export const updateServiceSchema = z.object({
  serviceId: z.string().min(1),
  name: z.string().min(1).max(100).trim().optional(),
  category: serviceCategoryEnum.optional(),
  brand: z.string().max(100).trim().nullable().optional(),
  description: z.string().min(1).max(2000).trim().optional(),
  basePrice: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  estimatedDurationMinutes: z.number().int().min(1).max(20160).optional(),
  warrantyLabel: z.string().max(200).trim().nullable().optional(),
  warrantyDurationValue: z.number().int().min(1).nullable().optional(),
  warrantyDurationUnit: warrantyDurationUnitEnum.nullable().optional(),
  vehicleCategoryPricing: z.array(vehicleCategoryPricingSchema).optional(),
  requiredBayType: bayTypeEnum.optional(),
  membershipWashEligible: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
}).strict();

export const setServiceActiveSchema = z.object({
  serviceId: z.string().min(1),
  active: z.boolean(),
}).strict();

export const getServiceCatalogueSchema = z.object({
  category: serviceCategoryEnum.optional(),
}).strict();

export const calculatePriceSchema = z.object({
  serviceId: z.string().min(1),
  vehicleCategory: vehicleCategoryEnum,
}).strict();

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type SetServiceActiveInput = z.infer<typeof setServiceActiveSchema>;
export type GetServiceCatalogueInput = z.infer<typeof getServiceCatalogueSchema>;
export type CalculatePriceInput = z.infer<typeof calculatePriceSchema>;
