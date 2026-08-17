import { z } from "zod";

const bayTypeEnum = z.enum(["wash", "protection", "general"]);

const operatingHoursSchema = z.object({
  dayOfWeek: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  open: z.string().regex(/^\d{2}:\d{2}$/, "open must be HH:mm"),
  close: z.string().regex(/^\d{2}:\d{2}$/, "close must be HH:mm"),
  closed: z.boolean(),
});

export const updateStudioSettingsSchema = z.object({
  studioId: z.string().min(1),
  name: z.string().min(1).max(100).trim().optional(),
  timezone: z.string().min(1).max(64).optional(),
  operatingHours: z.array(operatingHoursSchema).length(7).optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  taxDescription: z.string().min(1).max(100).trim().optional(),
});

export const addHolidaySchema = z.object({
  studioId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  reason: z.string().max(200).trim().optional(),
});

export const removeHolidaySchema = z.object({
  studioId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

export const upsertBaySchema = z.object({
  studioId: z.string().min(1),
  bayId: z.string().min(1).optional(), // omit to create a new bay
  name: z.string().min(1).max(100).trim(),
  bayType: bayTypeEnum,
  active: z.boolean(),
});

export type UpdateStudioSettingsInput = z.infer<typeof updateStudioSettingsSchema>;
export type AddHolidayInput = z.infer<typeof addHolidaySchema>;
export type RemoveHolidayInput = z.infer<typeof removeHolidaySchema>;
export type UpsertBayInput = z.infer<typeof upsertBaySchema>;
