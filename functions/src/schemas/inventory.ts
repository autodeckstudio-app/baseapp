import { z } from "zod";

const category = z.enum(["PPF_FILM", "CERAMIC", "WASH", "INTERIOR", "OTHER"]);
const unit = z.enum(["ML", "FT", "PCS", "GM"]);

export const addInventoryItemSchema = z.object({
  studioId: z.string().min(1),
  name: z.string().min(1).max(120),
  category,
  unit,
  stockQty: z.number().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.number().min(0).max(1_000_000).optional(),
  costPerUnit: z.number().int().min(0).max(100_000_000).optional(), // paise
}).strict();

export const updateInventoryItemSchema = z.object({
  itemId: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  category: category.optional(),
  unit: unit.optional(),
  lowStockThreshold: z.number().min(0).max(1_000_000).optional(),
  costPerUnit: z.number().int().min(0).max(100_000_000).optional(),
  active: z.boolean().optional(),
}).strict();

export const recordInventoryTxnSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(["PURCHASE", "USAGE", "ADJUSTMENT", "WASTAGE"]),
  qtyDelta: z.number().min(-1_000_000).max(1_000_000).refine((v) => v !== 0, "qtyDelta must be non-zero"),
  refType: z.enum(["job", "invoice", "none"]).optional(),
  refId: z.string().max(120).optional(),
  notes: z.string().max(300).optional(),
}).strict();

export const listInventoryItemsSchema = z.object({
  studioId: z.string().min(1),
  category: category.optional(),
  includeInactive: z.boolean().optional(),
}).strict();

export const listInventoryTxnsSchema = z.object({
  studioId: z.string().min(1),
  itemId: z.string().min(1).optional(),
}).strict();
