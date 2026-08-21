import { z } from "zod";

// Payments key off jobId — the payable operational job — not bookingId, so the
// same functions work uniformly whether the job originated from a booking or
// a walk-in. bookingId remains on the Payment/Invoice records themselves as an
// optional (nullable) cross-reference, never as the required lookup key.
export const initiatePaymentSchema = z.object({
  jobId: z.string().min(1),
  method: z.enum(["razorpay_payment_link", "cash", "upi_manual", "bank_transfer"]),
}).strict();

export const confirmPaymentMockSchema = z.object({
  paymentId: z.string().min(1),
  // 'success' simulates a successful provider webhook; 'failure' simulates a failed payment
  mockResult: z.enum(["success", "failure"]),
}).strict();

export const recordManualPaymentSchema = z.object({
  jobId: z.string().min(1),
  method: z.enum(["cash", "upi_manual", "bank_transfer"]),
  manualReference: z.string().optional(),
}).strict();

export const confirmManualPaymentSchema = z.object({
  paymentId: z.string().min(1),
}).strict();

export const initiateRefundSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().min(1).max(500),
}).strict();
