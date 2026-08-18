import { describe, it, expect } from "vitest";
import { buildApproval } from "../../lib/approval-builder.js";
import type { ServiceJob, Service } from "@autodeck/core";

const BASE_JOB: ServiceJob = {
  id: "job-1",
  tenantId: "tenant-a",
  studioId: "studio-1",
  bookingId: "booking-1",
  customerId: "cust-1",
  vehicleId: "veh-1",
  serviceId: "svc-original",
  bayId: "bay-1",
  assignedEmployeeId: "emp-1",
  status: "IN_PROGRESS",
  statusHistory: [],
  scheduledAt: "2026-01-01T04:00:00.000Z",
  scheduledDate: "2026-01-01",
  estimatedEndAt: "2026-01-01T06:00:00.000Z",
  estimatedDurationMinutes: 120,
  studioNotes: null,
  additionalWorkDelta: 0,
  priceBreakdown: {
    vehicleCategory: "suv",
    basePrice: 200000,
    scopeAdjustment: 0,
    addOns: [],
    subtotal: 200000,
    membershipDiscount: null,
    membershipDiscountPercent: null,
    pickupFee: 0,
    dropFee: 0,
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    tax: 36000,
    total: 236000,
    currency: "INR",
  },
  totalAmount: 236000,
  paymentStatus: "unpaid",
  isWalkIn: false,
  createdAt: "2026-01-01T04:00:00.000Z",
  updatedAt: "2026-01-01T04:00:00.000Z",
  sealedAt: null,
};

const ADDITIONAL_SERVICE: Service = {
  id: "svc-interior",
  tenantId: "tenant-a",
  name: "Interior Restoration",
  category: "other",
  brand: null,
  description: "Deep interior restoration",
  basePrice: 150000, // 1500 INR paise
  currency: "INR",
  estimatedDurationMinutes: 60,
  warrantyLabel: null,
  warrantyDurationValue: null,
  warrantyDurationUnit: null,
  vehicleCategoryPricing: [{ vehicleCategory: "suv", additionalPricePaise: 0, additionalMinutes: 0 }],
  requiredBayType: "general",
  membershipWashEligible: false,
  active: true,
  displayOrder: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("buildApproval", () => {
  it("computes price via the pricing engine — never trusts a client-supplied price", () => {
    const approval = buildApproval({
      id: "appr-1",
      job: BASE_JOB,
      service: ADDITIONAL_SERVICE,
      quantity: 1,
      reason: "Found stained interior",
      requestedBy: "staff-1",
      createdAt: "2026-01-02T10:00:00.000Z",
    });
    // 150000 base + 18% GST = 177000
    expect(approval.unitPrice).toBe(177000);
    expect(approval.priceImpact).toBe(177000);
  });

  it("scales price and time impact by quantity", () => {
    const approval = buildApproval({
      id: "appr-2",
      job: BASE_JOB,
      service: ADDITIONAL_SERVICE,
      quantity: 3,
      reason: "Three panels",
      requestedBy: "staff-1",
      createdAt: "2026-01-02T10:00:00.000Z",
    });
    expect(approval.priceImpact).toBe(177000 * 3);
    expect(approval.timeImpactMinutes).toBe(60 * 3);
  });

  it("snapshots originalAmount from job.totalAmount and derives newTotal", () => {
    const approval = buildApproval({
      id: "appr-3",
      job: BASE_JOB,
      service: ADDITIONAL_SERVICE,
      quantity: 1,
      reason: "x",
      requestedBy: "staff-1",
      createdAt: "2026-01-02T10:00:00.000Z",
    });
    expect(approval.originalAmount).toBe(236000);
    expect(approval.newTotal).toBe(236000 + 177000);
  });

  it("preserves the original job's price breakdown — never rewrites it", () => {
    buildApproval({
      id: "appr-4",
      job: BASE_JOB,
      service: ADDITIONAL_SERVICE,
      quantity: 1,
      reason: "x",
      requestedBy: "staff-1",
      createdAt: "2026-01-02T10:00:00.000Z",
    });
    expect(BASE_JOB.priceBreakdown.total).toBe(236000);
    expect(BASE_JOB.totalAmount).toBe(236000);
  });

  it("snapshots tenant, studio, job, booking, customer, and vehicle references", () => {
    const approval = buildApproval({
      id: "appr-5",
      job: BASE_JOB,
      service: ADDITIONAL_SERVICE,
      quantity: 1,
      reason: "x",
      requestedBy: "staff-1",
      createdAt: "2026-01-02T10:00:00.000Z",
    });
    expect(approval.tenantId).toBe("tenant-a");
    expect(approval.studioId).toBe("studio-1");
    expect(approval.jobId).toBe("job-1");
    expect(approval.bookingId).toBe("booking-1");
    expect(approval.customerId).toBe("cust-1");
    expect(approval.vehicleId).toBe("veh-1");
    expect(approval.serviceId).toBe("svc-interior");
    expect(approval.serviceName).toBe("Interior Restoration");
  });

  it("starts pending, unresponded, with an expiry 24h after creation", () => {
    const approval = buildApproval({
      id: "appr-6",
      job: BASE_JOB,
      service: ADDITIONAL_SERVICE,
      quantity: 1,
      reason: "x",
      requestedBy: "staff-1",
      createdAt: "2026-01-02T10:00:00.000Z",
    });
    expect(approval.status).toBe("pending");
    expect(approval.respondedAt).toBeNull();
    expect(approval.respondedBy).toBeNull();
    expect(approval.expiresAt).toBe("2026-01-03T10:00:00.000Z");
  });

  it("supports a walk-in job (no booking) with a null bookingId", () => {
    const walkinJob: ServiceJob = { ...BASE_JOB, bookingId: null, isWalkIn: true };
    const approval = buildApproval({
      id: "appr-7",
      job: walkinJob,
      service: ADDITIONAL_SERVICE,
      quantity: 1,
      reason: "x",
      requestedBy: "staff-1",
      createdAt: "2026-01-02T10:00:00.000Z",
    });
    expect(approval.bookingId).toBeNull();
  });
});
