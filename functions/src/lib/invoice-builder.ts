// Builds an Invoice from an immutable server-computed price snapshot.
// The snapshot (priceBreakdown) is the authoritative source of all invoice
// amounts — catalogue pricing changes after the snapshot was taken must NOT
// affect this invoice. The snapshot may originate from a Booking or from a
// walk-in Job; this function has no dependency on either — it only needs the
// resolved PriceBreakdown and the entity references to stamp onto the Invoice.
import type { Invoice, PriceBreakdown } from "@autodeck/core";
import { randomUUID } from "node:crypto";

export interface BuildInvoiceParams {
  invoiceId: string;
  invoiceNumber: string; // allocated atomically by allocateInvoiceNumber()
  tenantId: string;
  studioId: string;
  jobId: string; // the payable operational job — booking-sourced or walk-in
  bookingId: string | null; // null for walk-ins; never a fabricated value
  customerId: string;
  vehicleId: string;
  priceBreakdown: PriceBreakdown; // immutable snapshot — booking's or job's own
  paymentId: string | null;
  serviceName: string; // snapshotted from context (not re-read from catalogue)
}

export function buildInvoice(params: BuildInvoiceParams): Invoice {
  const {
    invoiceId,
    invoiceNumber,
    tenantId,
    studioId,
    jobId,
    bookingId,
    customerId,
    vehicleId,
    priceBreakdown: pb,
    paymentId,
    serviceName,
  } = params;
  const now = new Date().toISOString();

  // Line items reflect the immutable price snapshot
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
    tenantId,
    studioId,
    jobId,
    bookingId,
    customerId,
    vehicleId,
    paymentId,
    invoiceNumber,
    lineItems,
    subtotal,
    taxRatePercent: pb.taxRatePercent,
    taxDescription: pb.taxDescription,
    tax: pb.tax,
    total: pb.total, // must equal the source's totalAmount — never editable
    currency: pb.currency,
    status: paymentId ? "issued" : "draft",
    pdfUrl: null,
    // Reserved for a future unauthenticated/shareable invoice link — no
    // route or Cloud Function consumes this today (Phase 3H audit: kept as
    // deferred infrastructure, not removed, since the authenticated
    // customer/admin invoice views already satisfy the current requirement
    // and dropping the field would touch invoice identity for no benefit).
    publicToken: randomUUID(),
    issuedAt: paymentId ? now : null,
    voidedAt: null,
    voidedReason: null,
    createdAt: now,
    updatedAt: now,
  };
}
