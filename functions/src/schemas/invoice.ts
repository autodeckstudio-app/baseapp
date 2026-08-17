import { z } from "zod";

export const getInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
});

export const voidInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().min(1).max(500),
});
