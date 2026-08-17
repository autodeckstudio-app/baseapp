import { z } from "zod";

export const initiatePaymentSchema = z.object({
  bookingId: z.string().min(1),
  method: z.enum(["razorpay_payment_link", "cash", "upi_manual", "bank_transfer"]),
});

export const confirmPaymentMockSchema = z.object({
  paymentId: z.string().min(1),
  // 'success' simulates a successful provider webhook; 'failure' simulates a failed payment
  mockResult: z.enum(["success", "failure"]),
});

export const recordManualPaymentSchema = z.object({
  bookingId: z.string().min(1),
  method: z.enum(["cash", "upi_manual", "bank_transfer"]),
  manualReference: z.string().optional(),
});

export const getPaymentStatusSchema = z.object({
  bookingId: z.string().min(1),
});

export const initiateRefundSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().min(1).max(500),
});
