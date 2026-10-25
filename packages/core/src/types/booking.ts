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

export type QuoteStatus = "requested" | "quoted" | "approved";

export interface Booking {
  settlementKind?: "membership_covered";
  invoiceId?: string;
  /** Public projection only. Operational cancellation details are server-only. */
  cancelIntent?: { state: "waiting" | "needs_review" | "resolved"; requestedAt: string };
  id: string;
  // Set only for price-on-request services. requested -> quoted (studio sets price) -> approved (customer).
  quoteStatus?: QuoteStatus;
  priceOnRequest?: boolean;
  tenantId: string;
  studioId: string;
  customerId: string;
  vehicleId: string;
  // Copy of the car at booking time, so old bookings still read correctly if the car is edited or removed.
  vehicleSnapshot?: { registrationNumber: string; make: string; model: string; year: number; color: string; photoUrl: string | null };
  serviceId: string;
  /** Set when the visit has more than one service: main service first, then the extras. Prices are paise snapshots. */
  lines?: Array<{ serviceId: string; name: string; price: number; durationMinutes: number }>;
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
  /** Set when this visit is a redeemed gift wash (paid for by the buyer, so the total here is 0). */
  giftId?: string | null;
  membershipId: string | null; // set when a membership benefit was applied at booking creation
  membershipDiscountApplied: boolean; // true for either wash-credit or percent-discount redemption
  membershipWashUsed: boolean; // true only when an included wash credit was consumed
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
  /** How the customer chose to pay. */
  payMode?: "online" | "studio";
  /** PENDING online bookings hold their slot until this time (ISO). */
  holdExpiresAt?: string | null;
  /** Refund tracking on a cancelled, paid booking. */
  // requested = the current backend's recorded-request state: the refund claim
  //   was written durably at cancel time and has NOT been sent to the provider
  //   yet (no promise about provider acceptance or money movement).
  // reserved = legacy vocabulary for the same recorded-request state, kept so
  //   older written docs still render; no current backend writer.
  // initiated = the refund is recorded as in motion. Current backend: written
  //   by the MANUAL cash/UPI path when the studio records the return. Older
  //   writes used it for provider-accepted refunds - the value alone does not
  //   say which, so UI copy must stay mechanism-neutral.
  // processed = the provider reported this exact refund as processed (a provider status, NOT proof the money reached the bank).
  // failed = the provider refused it (legacy writer; no current backend writer).
  refundStatus?: "reserved" | "requested" | "initiated" | "processed" | "failed";
  refundProcessedAt?: string | null;
  refundId?: string | null;
  notes: string | null;
  idempotencyKey: string;
  rescheduleCount: number; // starts at 0; max enforced by Cloud Function
  standbyArrivedAt?: string | null;
  standbyAdmittedAt?: string | null;
  missedAt?: string | null; // persisted by the 9pm scheduler; cleared on reschedule
  missedForScheduledAt?: string | null; // identifies the missed slot
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  /** Fee in paise for a customer cancel inside the free window (cancellation-policy.ts). Recorded only; the studio settles it. Absent or 0 = no fee. */
  cancellationFeePaise?: number;
  /** Who settles the fee and how it ended: "due" until the studio marks it, then "collected", "withheld" (kept from a refund) or "waived". */
  cancellationFeeStatus?: "due" | "collected" | "withheld" | "waived";
  cancelledBy?: "customer" | "admin" | "system";
  /** Set when an admin cancelled as the studio (full refund, no customer fee). */
  cancelledByStudio?: boolean;
  /** Historical recorded cash compensation obligation. Preserved for older bookings; new studio cancellations do not create this obligation. */
  studioCompensationPaise?: number;
  /** Historical obligation status, preserved without waiver or payout. No settlement or payout flow exists. */
  studioCompensationStatus?: "due";
  cancellationFeeSettledBy?: string;
  cancellationFeeSettledAt?: string;
  cancellationFeeNote?: string;
  /** Paise sent back to the customer when an admin cancelled a paid booking. */
  refundedPaise?: number;
  /** Manual/counter cancel: paise OWED to the customer and NOT yet returned. Not a refund claim; payment stays completed. */
  manualRefundDuePaise?: number | null;
  /** Service categories of the visit (primary first), saved at booking time so the cancel band cannot change later. */
  cancelCategories?: string[];
  createdAt: string;
  updatedAt: string;
}
