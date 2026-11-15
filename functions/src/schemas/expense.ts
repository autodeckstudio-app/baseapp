import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
const monthString = z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM");
const category = z.enum([
  "SUPPLIES",
  "EQUIPMENT",
  "RENT",
  "UTILITIES",
  "SALARY_ADVANCE",
  "MAINTENANCE",
  "MARKETING",
  "OTHER",
]);
const paidVia = z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"]);

export const createExpenseSchema = z.object({
  studioId: z.string().min(1),
  amount: z.number().int().positive().max(100_000_000), // paise, <= 10 lakh
  category,
  paidVia,
  vendor: z.string().max(120).optional(),
  date: dateString,
  notes: z.string().max(300).optional(),
}).strict();

export const updateExpenseSchema = z.object({
  expenseId: z.string().min(1),
  amount: z.number().int().positive().max(100_000_000).optional(),
  category: category.optional(),
  paidVia: paidVia.optional(),
  vendor: z.string().max(120).nullable().optional(),
  date: dateString.optional(),
  notes: z.string().max(300).nullable().optional(),
}).strict();

export const deleteExpenseSchema = z.object({
  expenseId: z.string().min(1),
}).strict();

export const listExpensesSchema = z.object({
  studioId: z.string().min(1),
  month: monthString.optional(),
  category: category.optional(),
}).strict();
