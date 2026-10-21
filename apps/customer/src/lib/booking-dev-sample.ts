// Dev preview only. Sample data for /preview-booking?mock=1. Not real bookings, not used in production builds.
import type { Booking } from "@autodeck/core";

// Tomorrow 10:00 to 11:30 India time, built so the start, the studio date and the end all agree.
const IST_MS = 5.5 * 3600_000;
const tomorrow = new Date(Date.now() + IST_MS + 24 * 3600_000).toISOString().slice(0, 10);
const date = tomorrow;
const iso = new Date(`${tomorrow}T10:00:00Z`).getTime() - IST_MS;
const startIso = new Date(iso).toISOString();
const endIso = new Date(iso + 90 * 60_000).toISOString();

export const DEV_SAMPLE_BOOKING = {
  id: "devSampleBookingId0001",
  tenantId: "t", studioId: "s", customerId: "c", vehicleId: "v",
  vehicleSnapshot: { registrationNumber: "GJ01 AB 1234", make: "Skoda", model: "Slavia", year: 2023, color: "Grey", photoUrl: null },
  serviceId: "svc-wash-premium", vehicleCategory: "sedan",
  scheduledAt: startIso, scheduledDate: date, scheduledTime: "10:00",
  estimatedEndAt: endIso, estimatedEndDate: date, estimatedEndTime: "11:30", durationMinutes: 90,
  bayId: "b", assignedEmployeeId: null, status: "ACTIVE",
  priceBreakdown: { vehicleCategory: "sedan", basePrice: 100000, scopeAdjustment: 0, addOns: [], subtotal: 100000, membershipDiscount: null, membershipDiscountPercent: null, pickupFee: 0, dropFee: 0, taxRatePercent: 18, taxDescription: "GST 18%", tax: 18000, total: 118000, currency: "INR" },
  totalAmount: 118000, membershipId: null, membershipDiscountApplied: false, membershipWashUsed: false,
  paymentStatus: "paid", payMode: "online", notes: null, idempotencyKey: "k", rescheduleCount: 0, confirmedAt: startIso,
} as unknown as Booking;

export const DEV_SAMPLE_SERVICE = { name: "Premium Wash", category: "washing", brand: null, imageUrl: null };
