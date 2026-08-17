import type { VehicleCategory } from "./service.js";

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

// Price breakdown — snapshotted at booking creation; immutable thereafter.
// All amounts in paise (INR * 100). No floating-point arithmetic for money.
// (doc06 §6.4 Historical Truth Rule 1)
export interface PriceBreakdown {
  vehicleCategory: VehicleCategory; // snapshotted — drives scopeAdjustment
  basePrice: number; // paise — service.basePrice at snapshot time
  scopeAdjustment: number; // paise — vehicle category adjustment (V1); scope adjustment (V2+)
  addOns: Array<{ id: string; name: string; price: number }>; // paise each; empty in V1
  subtotal: number; // paise = basePrice + scopeAdjustment + sum(addOns)
  membershipDiscount: number | null; // paise; null in V1
  membershipDiscountPercent: number | null; // null in V1
  pickupFee: number; // paise — 0 in V1 (no pickup/drop)
  dropFee: number; // paise — 0 in V1
  taxRatePercent: number; // snapshotted; default 18 (GST 18%)
  taxDescription: string; // e.g. "GST 18%"; snapshotted
  tax: number; // paise = Math.round(subtotal * taxRatePercent / 100)
  total: number; // paise = subtotal + tax
  currency: string; // ISO 4217; snapshotted
}

export interface Booking {
  id: string;
  tenantId: string;
  studioId: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  vehicleCategory: VehicleCategory;
  scheduledAt: string; // ISO UTC — slot start time
  scheduledDate: string; // "YYYY-MM-DD" in studio TZ — for date-scoped queries
  scheduledTime: string; // "HH:mm" in studio TZ
  estimatedEndAt: string; // ISO UTC = scheduledAt + durationMinutes
  estimatedEndDate: string; // "YYYY-MM-DD" in studio TZ
  estimatedEndTime: string; // "HH:mm" in studio TZ
  durationMinutes: number; // snapshotted at booking creation (service duration, excl. buffer)
  bayId: string; // assigned at booking creation
  assignedEmployeeId: string | null;
  status: BookingStatus;
  priceBreakdown: PriceBreakdown;
  totalAmount: number; // paise — equals priceBreakdown.total
  membershipDiscountApplied: boolean;
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
  notes: string | null;
  idempotencyKey: string;
  rescheduleCount: number; // starts at 0; max enforced by Cloud Function
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}
