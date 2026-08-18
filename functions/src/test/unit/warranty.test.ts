import { describe, it, expect } from "vitest";
import { buildWarranty } from "../../lib/warranty-builder.js";
import type { ServiceJob, Service } from "@autodeck/core";

const BASE_JOB: ServiceJob = {
  id: "job-1",
  tenantId: "tenant-a",
  studioId: "studio-1",
  bookingId: "booking-1",
  customerId: "cust-1",
  vehicleId: "veh-1",
  serviceId: "svc-1",
  bayId: "bay-1",
  assignedEmployeeId: "emp-1",
  status: "DELIVERED",
  statusHistory: [],
  scheduledAt: "2026-01-01T04:00:00.000Z",
  scheduledDate: "2026-01-01",
  estimatedEndAt: "2026-01-01T06:00:00.000Z",
  estimatedDurationMinutes: 120,
  studioNotes: null,
  additionalWorkDelta: 0,
  priceBreakdown: {
    vehicleCategory: "suv",
    basePrice: 5000000,
    scopeAdjustment: 0,
    addOns: [],
    subtotal: 5000000,
    membershipDiscount: null,
    membershipDiscountPercent: null,
    pickupFee: 0,
    dropFee: 0,
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    tax: 900000,
    total: 5900000,
    currency: "INR",
  },
  totalAmount: 5900000,
  paymentStatus: "unpaid",
  isWalkIn: false,
  createdAt: "2026-01-01T04:00:00.000Z",
  updatedAt: "2026-01-03T10:00:00.000Z",
  sealedAt: "2026-01-03T10:00:00.000Z",
};

const PPF_SERVICE: Service = {
  id: "svc-1",
  tenantId: "tenant-a",
  name: "LLumar Gloss PPF",
  category: "ppf",
  brand: "LLumar",
  description: "Full body PPF",
  basePrice: 5000000,
  currency: "INR",
  estimatedDurationMinutes: 120,
  warrantyLabel: "5-Year PPF Film Warranty",
  vehicleCategoryPricing: [],
  requiredBayType: "protection",
  membershipWashEligible: false,
  active: true,
  displayOrder: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const WASH_SERVICE: Service = { ...PPF_SERVICE, id: "svc-2", warrantyLabel: null, category: "washing" };

describe("buildWarranty", () => {
  it("returns null when the service carries no warranty", () => {
    const result = buildWarranty({ job: BASE_JOB, service: WASH_SERVICE, sealedAt: "2026-01-03T10:00:00.000Z" });
    expect(result).toBeNull();
  });

  it("builds a Warranty with id == jobId (deterministic idempotency key)", () => {
    const result = buildWarranty({ job: BASE_JOB, service: PPF_SERVICE, sealedAt: "2026-01-03T10:00:00.000Z" });
    expect(result?.id).toBe(BASE_JOB.id);
    expect(result?.jobId).toBe(BASE_JOB.id);
  });

  it("snapshots customer, vehicle, service name, and warranty terms from the inputs", () => {
    const result = buildWarranty({ job: BASE_JOB, service: PPF_SERVICE, sealedAt: "2026-01-03T10:00:00.000Z" });
    expect(result?.customerId).toBe(BASE_JOB.customerId);
    expect(result?.vehicleId).toBe(BASE_JOB.vehicleId);
    expect(result?.tenantId).toBe(BASE_JOB.tenantId);
    expect(result?.serviceName).toBe(PPF_SERVICE.name);
    expect(result?.warrantyLabel).toBe(PPF_SERVICE.warrantyLabel);
    expect(result?.coverageTerms).toBe(PPF_SERVICE.warrantyLabel);
  });

  it("preserves the originating booking reference, including null for walk-ins", () => {
    const result = buildWarranty({ job: BASE_JOB, service: PPF_SERVICE, sealedAt: "2026-01-03T10:00:00.000Z" });
    expect(result?.bookingId).toBe("booking-1");

    const walkinJob: ServiceJob = { ...BASE_JOB, bookingId: null, isWalkIn: true };
    const walkinResult = buildWarranty({ job: walkinJob, service: PPF_SERVICE, sealedAt: "2026-01-03T10:00:00.000Z" });
    expect(walkinResult?.bookingId).toBeNull();
  });

  it("derives startDate from sealedAt and leaves endDate null (no structured duration on Service)", () => {
    const result = buildWarranty({ job: BASE_JOB, service: PPF_SERVICE, sealedAt: "2026-01-03T10:00:00.000Z" });
    expect(result?.startDate).toBe("2026-01-03");
    expect(result?.endDate).toBeNull();
  });

  it("leaves certificateUrl and qrVerificationToken null (no PDF service in this build)", () => {
    const result = buildWarranty({ job: BASE_JOB, service: PPF_SERVICE, sealedAt: "2026-01-03T10:00:00.000Z" });
    expect(result?.certificateUrl).toBeNull();
    expect(result?.qrVerificationToken).toBeNull();
  });

  it("is unrevoked at issuance", () => {
    const result = buildWarranty({ job: BASE_JOB, service: PPF_SERVICE, sealedAt: "2026-01-03T10:00:00.000Z" });
    expect(result?.revokedAt).toBeNull();
    expect(result?.revokedReason).toBeNull();
  });
});
