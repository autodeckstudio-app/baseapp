import { describe, expect, it } from "vitest";
import type { Booking, ServiceJob, Vehicle } from "@autodeck/core";
import { projectCustomerHome } from "../home";
import { projectVisitTimeline } from "../timeline";

const vehicle: Vehicle = {
  id: "v1",
  tenantId: "autodeck",
  ownerId: "u1",
  registrationNumber: "GJ01AB1234",
  make: "BMW",
  model: "M3",
  year: 2025,
  color: "Black",
  category: "sedan",
  photoUrl: null,
  odometer: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-09-01",
  deletedAt: null,
};
const booking: Booking = {
  id: "b1",
  tenantId: "autodeck",
  studioId: "s1",
  customerId: "u1",
  vehicleId: "v1",
  serviceId: "svc",
  vehicleCategory: "sedan",
  scheduledAt: "2026-10-01T04:00:00Z",
  scheduledDate: "2026-10-01",
  scheduledTime: "09:30",
  estimatedEndAt: "2026-10-01T08:00:00Z",
  estimatedEndDate: "2026-10-01",
  estimatedEndTime: "13:30",
  durationMinutes: 240,
  bayId: "bay1",
  assignedEmployeeId: null,
  status: "CONFIRMED",
  priceBreakdown: {
    vehicleCategory: "sedan",
    basePrice: 100,
    scopeAdjustment: 0,
    addOns: [],
    subtotal: 100,
    membershipDiscount: null,
    membershipDiscountPercent: null,
    pickupFee: 0,
    dropFee: 0,
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    tax: 18,
    total: 118,
    currency: "INR",
  },
  totalAmount: 118,
  membershipId: null,
  membershipDiscountApplied: false,
  membershipWashUsed: false,
  paymentStatus: "unpaid",
  notes: null,
  idempotencyKey: "k",
  rescheduleCount: 0,
  confirmedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: "2026-09-01",
  updatedAt: "2026-09-01",
};
const job: ServiceJob = {
  id: "j1",
  tenantId: "autodeck",
  studioId: "s1",
  bookingId: "b1",
  customerId: "u1",
  vehicleId: "v1",
  serviceId: "svc",
  bayId: "bay1",
  assignedEmployeeId: null,
  status: "IN_PROGRESS",
  statusHistory: [
    {
      status: "PENDING_VEHICLE",
      changedAt: "2026-10-01T03:55:00Z",
      changedBy: "system",
      notes: null,
    },
    {
      status: "VEHICLE_RECEIVED",
      changedAt: "2026-10-01T04:05:00Z",
      changedBy: "staff",
      notes: null,
    },
    {
      status: "IN_PROGRESS",
      changedAt: "2026-10-01T04:15:00Z",
      changedBy: "staff",
      notes: null,
    },
  ],
  scheduledAt: booking.scheduledAt,
  scheduledDate: booking.scheduledDate,
  estimatedEndAt: booking.estimatedEndAt,
  estimatedEndDate: booking.estimatedEndDate,
  estimatedDurationMinutes: 240,
  studioNotes: null,
  additionalWorkDelta: 0,
  priceBreakdown: booking.priceBreakdown,
  totalAmount: 118,
  paymentStatus: "unpaid",
  isWalkIn: false,
  createdAt: "2026-10-01",
  updatedAt: "2026-10-01",
  sealedAt: null,
};

describe("projectCustomerHome", () => {
  it("starts with the garage when no vehicle exists", () =>
    expect(
      projectCustomerHome({ vehicles: [], bookings: [], jobs: [] }).heroState,
    ).toBe("empty"));
  it("shows the selected vehicle and booking", () => {
    const x = projectCustomerHome({
      displayName: "Meet Sheth",
      vehicles: [vehicle],
      selectedVehicleId: "v1",
      bookings: [booking],
      jobs: [],
    });
    expect(x.firstName).toBe("Meet");
    expect(x.heroState).toBe("booked");
    expect(x.activeVehicle?.id).toBe("v1");
  });
  it("prioritizes an approval above live job state", () =>
    expect(
      projectCustomerHome({
        vehicles: [vehicle],
        bookings: [booking],
        jobs: [job],
        pendingApprovalId: "a1",
      }).heroState,
    ).toBe("awaitingApproval"));
});

describe("projectVisitTimeline", () => {
  it("derives reached, current and upcoming stages from canonical status", () => {
    const x = projectVisitTimeline(job);
    expect(x.find((s) => s.status === "VEHICLE_RECEIVED")?.state).toBe(
      "reached",
    );
    expect(x.find((s) => s.status === "IN_PROGRESS")?.state).toBe("current");
    expect(x.find((s) => s.status === "QUALITY_CHECK")?.state).toBe("upcoming");
  });
});
