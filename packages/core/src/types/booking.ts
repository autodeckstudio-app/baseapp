import type { VehicleCategory } from "./service.js";

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export interface PriceBreakdown {
  basePrice: number; // paise
  scopeAdjustment: number; // paise — based on vehicle category
  addOns: Array<{ id: string; name: string; price: number }>; // paise
  subtotal: number; // paise
  membershipDiscount: number | null; // paise
  membershipDiscountPercent: number | null;
  pickupFee: number; // paise — 0 in V1 (no pickup/drop)
  dropFee: number; // paise — 0 in V1
  taxRatePercent: number; // snapshotted at booking creation; default 18 (GST)
  taxDescription: string; // e.g. "GST 18%"
  tax: number; // paise
  total: number; // paise
  currency: string; // ISO 4217 — "INR" for V1
}

export interface Booking {
  id: string;
  tenantId: string;
  studioId: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  vehicleCategory: VehicleCategory;
  scheduledAt: string; // ISO timestamp — start of slot
  durationMinutes: number; // snapshotted at booking creation
  bayId: string | null; // assigned at confirmation
  assignedEmployeeId: string | null;
  status: BookingStatus;
  priceBreakdown: PriceBreakdown;
  totalAmount: number; // paise — equals priceBreakdown.total
  membershipDiscountApplied: boolean;
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
  notes: string | null;
  idempotencyKey: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}
