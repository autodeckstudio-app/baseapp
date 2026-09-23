import { z } from "zod";

const category = z.enum(["BEFORE_AFTER", "PPF", "CERAMIC", "WASH", "STUDIO", "OTHER"]);

export const addGalleryImageSchema = z.object({
  studioId: z.string().min(1),
  imageUrl: z.string().url().max(1000),
  caption: z.string().max(200).optional(),
  category,
  vehicleLabel: z.string().max(80).optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
}).strict();

export const updateGalleryImageSchema = z.object({
  imageId: z.string().min(1),
  caption: z.string().max(200).nullable().optional(),
  category: category.optional(),
  vehicleLabel: z.string().max(80).nullable().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
}).strict();

export const deleteGalleryImageSchema = z.object({
  imageId: z.string().min(1),
}).strict();

export const listGalleryImagesSchema = z.object({
  studioId: z.string().min(1),
  includeInactive: z.boolean().optional(),
}).strict();
