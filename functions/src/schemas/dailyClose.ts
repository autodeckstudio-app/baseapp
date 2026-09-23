import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

export const performDailyCloseSchema = z.object({
  studioId: z.string().min(1),
  date: dateString,
  countedCashPaise: z.number().int().min(0).max(1_000_000_000),
  notes: z.string().max(300).optional(),
  reclose: z.boolean().optional(),
}).strict();

export const getDailyCloseSchema = z.object({
  studioId: z.string().min(1),
  date: dateString,
}).strict();
