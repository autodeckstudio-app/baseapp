// Builds an ApprovalRequest snapshot from the job + the selected catalogue
// Service, both read at request time. Price is always computed via the same
// pricing engine used for bookings (calculatePrice) — never trusted from the
// client. originalAmount/newTotal are frozen here so the customer sees a
// coherent before/after even if other approvals resolve in between.
import type { ApprovalRequest, Service, ServiceJob } from "@autodeck/core";
import { APPROVAL_EXPIRY_HOURS } from "@autodeck/core";
import { calculatePrice } from "./pricing.js";

export interface BuildApprovalParams {
  id: string;
  job: ServiceJob;
  service: Service;
  quantity: number;
  reason: string;
  requestedBy: string;
  createdAt: string; // ISO
}

export function buildApproval(params: BuildApprovalParams): ApprovalRequest {
  const { id, job, service, quantity, reason, requestedBy, createdAt } = params;

  const breakdown = calculatePrice({
    basePrice: service.basePrice,
    vehicleCategory: job.priceBreakdown.vehicleCategory,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    taxRatePercent: job.priceBreakdown.taxRatePercent,
    taxDescription: job.priceBreakdown.taxDescription,
    currency: job.priceBreakdown.currency,
  });
  const unitPrice = breakdown.total;
  const priceImpact = unitPrice * quantity;
  const timeImpactMinutes = service.estimatedDurationMinutes * quantity;

  return {
    id,
    tenantId: job.tenantId,
    studioId: job.studioId,
    jobId: job.id,
    bookingId: job.bookingId,
    customerId: job.customerId,
    vehicleId: job.vehicleId,
    requestedBy,
    reason,
    serviceId: service.id,
    serviceName: service.name,
    quantity,
    unitPrice,
    priceImpact,
    timeImpactMinutes,
    originalAmount: job.totalAmount,
    newTotal: job.totalAmount + priceImpact,
    photos: [],
    status: "pending",
    respondedAt: null,
    respondedBy: null,
    expiresAt: new Date(new Date(createdAt).getTime() + APPROVAL_EXPIRY_HOURS * 3600000).toISOString(),
    createdAt,
  };
}
