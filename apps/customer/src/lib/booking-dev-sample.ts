// Dev preview only. Sample data for /preview-booking?mock=1. Not real bookings, not used in production builds.
import type { Booking } from "@autodeck/core";

const when = new Date(Date.now() + 26 * 3600_000);
const iso = when.toISOString();
const date = iso.slice(0, 10);

export const DEV_SAMPLE_BOOKING = {
  id: "devSampleBookingId0001",
  tenantId: "t", studioId: "s", customerId: "c", vehicleId: "v",
  vehicleSnapshot: { registrationNumber: "GJ01 AB 1234", make: "Skoda", model: "Slavia", year: 2023, color: "Grey", photoUrl: null },
  serviceId: "svc-wash-premium", vehicleCategory: "sedan",
  scheduledAt: iso, scheduledDate: date, scheduledTime: "10:00",
  estimatedEndAt: iso, estimatedEndDate: date, estimatedEndTime: "11:30", durationMinutes: 90,
  bayId: "b", assignedEmployeeId: null, status: "ACTIVE",
  priceBreakdown: { vehicleCategory: "sedan", basePrice: 100000, scopeAdjustment: 0, addOns: [], subtotal: 100000, membershipDiscount: null, membershipDiscountPercent: null, pickupFee: 0, dropFee: 0, taxRatePercent: 18, taxDescription: "GST 18%", tax: 18000, total: 118000, currency: "INR" },
  totalAmount: 118000, membershipId: null, membershipDiscountApplied: false, membershipWashUsed: false,
  paymentStatus: "paid", payMode: "online", notes: null, idempotencyKey: "k", rescheduleCount: 0, confirmedAt: iso,
} as unknown as Booking;

export const DEV_SAMPLE_SERVICE = { name: "Premium Wash", category: "washing", brand: null, imageUrl: null };
