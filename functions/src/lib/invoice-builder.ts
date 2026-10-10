// Builds an Invoice from an immutable server-computed price snapshot.
// The snapshot (priceBreakdown) is the authoritative source of all invoice
// amounts — catalogue pricing changes after the snapshot was taken must NOT
// affect this invoice. The snapshot may originate from a Booking or from a
// walk-in Job; this function has no dependency on either — it only needs the
// resolved PriceBreakdown and the entity references to stamp onto the Invoice.
import type { ApprovalRequest, Invoice, PriceBreakdown, VehicleSnapshot } from "@autodeck/core";
import { calculateTax } from "./pricing.js";
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
  serviceId?: string; // reference only
  // Approved additional-work requests of the SAME job/visit. Each becomes its own
  // line item on this one invoice; totals include them (matches job.totalAmount).
  additionalWork?: ApprovalRequest[];
  vehicleSnapshot?: VehicleSnapshot;
  customerSnapshot?: { name: string };
}

// Splits a tax-inclusive per-unit amount (approval.unitPrice) back into net + tax
// using the same rounding as calculateTax, so the line net + its tax == the gross.
export function netFromGross(grossPaise: number, taxRatePercent: number): number {
  const guess = Math.round((grossPaise * 100) / (100 + taxRatePercent));
  for (const net of [guess, guess - 1, guess + 1, guess - 2, guess + 2]) {
    if (net + calculateTax(net, taxRatePercent) === grossPaise) return net;
  }
  return guess;
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
    serviceId,
    additionalWork = [],
    vehicleSnapshot,
    customerSnapshot,
  } = params;
  const now = new Date().toISOString();

  // Line items reflect the immutable price snapshot
  const lineItems: Invoice["lineItems"] = [
    {
      description: serviceName,
      serviceName,
      ...(serviceId ? { serviceId } : {}),
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

  // Additional work approved during this visit: one line per approved request.
  // Amounts are net of tax; their tax is folded into the invoice tax below.
  let additionalGross = 0;
  for (const a of additionalWork) {
    if (a.status !== "approved") continue;
    const unitNet = netFromGross(a.unitPrice, pb.taxRatePercent);
    lineItems.push({
      description: a.serviceName?.trim() || "Additional service",
      serviceName: a.serviceName?.trim() || "Additional service",
      serviceId: a.serviceId,
      quantity: a.quantity,
      unitPrice: unitNet,
      total: unitNet * a.quantity,
    });
    additionalGross += a.priceImpact;
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);

  // Membership benefit, if any (Phase 5B P1-9 fix — see Invoice.discount
  // doc comment). pb.membershipDiscount is already computed against this
  // same gross subtotal by applyMembershipBenefit(), so
  // subtotal - discount + tax === total holds by construction.
  const discount = pb.membershipDiscount ?? 0;
  const discountDescription =
    discount === 0
      ? null
      : pb.membershipDiscountPercent !== null
        ? `Membership discount (${pb.membershipDiscountPercent}%)`
        : "Membership wash credit";

  // Without additional work this is exactly the snapshot's total and tax.
  // With it, total == job.totalAmount and tax is whatever closes subtotal - discount + tax = total.
  const total = pb.total + additionalGross;
  const tax = additionalGross === 0 ? pb.tax : total - (subtotal - discount);

  return {
    id: invoiceId,
    tenantId,
    studioId,
    jobId,
    bookingId,
    customerId,
    vehicleId,
    visitId: jobId,
    ...(vehicleSnapshot ? { vehicleSnapshot } : {}),
    ...(customerSnapshot ? { customerSnapshot } : {}),
    paymentId,
    invoiceNumber,
    lineItems,
    subtotal,
    discount,
    discountDescription,
    taxRatePercent: pb.taxRatePercent,
    taxDescription: pb.taxDescription,
    tax,
    total, // must equal the job's totalAmount — never editable
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
