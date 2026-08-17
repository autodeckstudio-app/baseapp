// Builds an Invoice from a Booking's immutable price snapshot.
// The booking.priceBreakdown is the authoritative source of all invoice amounts.
// Catalogue pricing changes after booking must NOT affect this invoice.
import type { Invoice, Booking } from "@autodeck/core";
import { randomUUID } from "node:crypto";

export interface BuildInvoiceParams {
  invoiceId: string;
  invoiceNumber: string; // allocated atomically by allocateInvoiceNumber()
  booking: Booking;
  paymentId: string | null;
  studioId: string;
  serviceName: string; // snapshotted from booking context (not re-read from catalogue)
}

export function buildInvoice(params: BuildInvoiceParams): Invoice {
  const { invoiceId, invoiceNumber, booking, paymentId, studioId, serviceName } = params;
  const pb = booking.priceBreakdown;
  const now = new Date().toISOString();

  // Line items reflect the immutable booking price breakdown
  const lineItems: Invoice["lineItems"] = [
    {
      description: serviceName,
      quantity: 1,
      unitPrice: pb.basePrice + pb.scopeAdjustment,
      total: pb.basePrice + pb.scopeAdjustment,
    },
  ];

  // Pickup/drop fees (0 in V1, preserved for schema completeness)
  if (pb.pickupFee > 0) {
    lineItems.push({ description: "Pickup Fee", quantity: 1, unitPrice: pb.pickupFee, total: pb.pickupFee });
  }
  if (pb.dropFee > 0) {
    lineItems.push({ description: "Drop Fee", quantity: 1, unitPrice: pb.dropFee, total: pb.dropFee });
  }

  // Add-on line items
  for (const addOn of pb.addOns) {
    lineItems.push({
      description: addOn.name,
      quantity: 1,
      unitPrice: addOn.price,
      total: addOn.price,
    });
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);

  return {
    id: invoiceId,
    tenantId: booking.tenantId,
    studioId,
    jobId: "", // set by caller when job is sealed
    bookingId: booking.id,
    customerId: booking.customerId,
    vehicleId: booking.vehicleId,
    paymentId,
    invoiceNumber,
    lineItems,
    subtotal,
    taxRatePercent: pb.taxRatePercent,
    taxDescription: pb.taxDescription,
    tax: pb.tax,
    total: pb.total, // must equal booking.totalAmount — never editable
    currency: pb.currency,
    status: paymentId ? "issued" : "draft",
    pdfUrl: null,
    publicToken: randomUUID(),
    issuedAt: paymentId ? now : null,
    voidedAt: null,
    voidedReason: null,
    createdAt: now,
    updatedAt: now,
  };
}
