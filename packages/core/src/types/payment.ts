export type PaymentMethod = "razorpay_payment_link" | "cash" | "upi_manual" | "bank_transfer";

// doc06 statuses + "cancelled" (required by booking lifecycle; flagged in architecture)
// "processing" is intermediate Razorpay state between pending and completed
export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "refunded";

export type InvoiceStatus = "draft" | "issued" | "paid" | "void";

export interface Payment {
  id: string;
  tenantId: string;
  studioId: string;
  jobId: string;
  bookingId: string | null;
  customerId: string;
  // Amount is ALWAYS taken from booking.totalAmount — never from client request
  amount: number; // paise
  currency: string; // "INR"
  method: PaymentMethod;
  status: PaymentStatus;
  // Provider references (null for cash/manual)
  razorpayPaymentLinkId: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  // Refund tracking (set when a refund is issued)
  razorpayRefundId: string | null;
  refundAmount: number | null; // paise; null until refund initiated
  // Manual payment
  manualReference: string | null; // UPI ref, cash receipt #
  recordedBy: string | null; // employeeId for manual payments
  // Linked invoice (set when invoice is generated on payment completion)
  invoiceId: string | null;
  // Idempotency key for webhook/event deduplication
  providerEventId: string | null;
  // Timestamps
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  studioId: string;
  jobId: string;
  bookingId: string | null;
  customerId: string;
  vehicleId: string;
  paymentId: string | null; // linked payment (null for draft invoices before payment)
  invoiceNumber: string; // e.g. "INV-2026-00001" — generated atomically server-side
  // All financial fields are SNAPSHOTS from booking.priceBreakdown — immutable after issued
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number; // paise
    total: number; // paise
  }>;
  subtotal: number; // paise
  taxRatePercent: number; // snapshotted at booking creation
  taxDescription: string; // e.g. "GST 18%"
  tax: number; // paise
  total: number; // paise — must equal booking.totalAmount
  currency: string; // "INR"
  status: InvoiceStatus;
  pdfUrl: string | null;
  publicToken: string; // UUID for unauthenticated view
  issuedAt: string | null;
  voidedAt: string | null;
  voidedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceCounter {
  tenantId: string;
  nextNumber: number; // incremented atomically inside a Firestore transaction
  year: number; // resets to 1 on new calendar year
}
