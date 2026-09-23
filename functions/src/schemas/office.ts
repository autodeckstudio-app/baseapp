import { z } from "zod";

const monthString = z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM");

export const getOfficeDashboardSchema = z.object({
  studioId: z.string().min(1),
}).strict();

export const getOfficeReportSchema = z.object({
  studioId: z.string().min(1),
  month: monthString,
}).strict();
