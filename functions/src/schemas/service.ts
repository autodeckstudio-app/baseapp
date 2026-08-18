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
});

export const createServiceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  category: serviceCategoryEnum,
  brand: z.string().max(100).trim().nullable(),
  description: z.string().min(1).max(2000).trim(),
  basePrice: z.number().int().min(0, "Base price must be a non-negative integer (paise)"),
  currency: z.string().length(3).optional(),
  estimatedDurationMinutes: z.number().int().min(1).max(1440),
  warrantyLabel: z.string().max(200).trim().nullable(),
  // Optional: existing callers (e.g. the current admin catalogue form) don't
  // send these yet — omitted means unconfigured (null), never guessed.
  warrantyDurationValue: z.number().int().min(1).nullable().optional(),
  warrantyDurationUnit: warrantyDurationUnitEnum.nullable().optional(),
  vehicleCategoryPricing: z.array(vehicleCategoryPricingSchema).optional(),
  requiredBayType: bayTypeEnum.optional(),
  membershipWashEligible: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateServiceSchema = z.object({
  serviceId: z.string().min(1),
  name: z.string().min(1).max(100).trim().optional(),
  category: serviceCategoryEnum.optional(),
  brand: z.string().max(100).trim().nullable().optional(),
  description: z.string().min(1).max(2000).trim().optional(),
  basePrice: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).optional(),
  warrantyLabel: z.string().max(200).trim().nullable().optional(),
  warrantyDurationValue: z.number().int().min(1).nullable().optional(),
  warrantyDurationUnit: warrantyDurationUnitEnum.nullable().optional(),
  vehicleCategoryPricing: z.array(vehicleCategoryPricingSchema).optional(),
  requiredBayType: bayTypeEnum.optional(),
  membershipWashEligible: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const setServiceActiveSchema = z.object({
  serviceId: z.string().min(1),
  active: z.boolean(),
});

export const calculatePriceSchema = z.object({
  serviceId: z.string().min(1),
  vehicleCategory: vehicleCategoryEnum,
});

export const getServiceCatalogueSchema = z.object({
  category: serviceCategoryEnum.optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type SetServiceActiveInput = z.infer<typeof setServiceActiveSchema>;
export type CalculatePriceInput = z.infer<typeof calculatePriceSchema>;
export type GetServiceCatalogueInput = z.infer<typeof getServiceCatalogueSchema>;
