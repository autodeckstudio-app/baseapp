export type PaymentMethod = "razorpay_payment_link" | "cash" | "upi_manual" | "bank_transfer";
export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded";

export interface Payment {
  id: string;
  tenantId: string;
  studioId: string;
  jobId: string;
  bookingId: string | null;
  customerId: string;
  amount: number; // paise
  currency: string; // "INR"
  method: PaymentMethod;
  status: PaymentStatus;
  razorpayPaymentLinkId: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  receiptUrl: string | null; // Razorpay receipt URL
  manualReference: string | null; // for cash/UPI manual
  recordedBy: string | null; // employeeId for manual payments
  completedAt: string | null;
  failedAt: string | null;
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
  invoiceNumber: string; // human-readable, e.g. "INV-2026-0001"
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number; // paise
    total: number; // paise
  }>;
  subtotal: number; // paise
  taxRatePercent: number; // snapshotted
  taxDescription: string; // "GST 18%"
  tax: number; // paise
  total: number; // paise
  currency: string; // "INR"
  pdfUrl: string | null; // Storage signed URL
  publicToken: string; // for unauthenticated invoice view
  generatedAt: string;
  createdAt: string;
}
