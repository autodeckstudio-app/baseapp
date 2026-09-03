import type { BookingStatus, PriceSnapshot } from '@autodeck/domain';

/**
 * The `bookings/{id}` Firestore document shape.
 *
 * `status` and `priceSnapshot` reuse the pre-existing `BookingStatus` and
 * `PriceSnapshot` domain types (see `packages/domain/src/types.ts`,
 * `stateMachine.ts`, `pricing.ts`) rather than re-declaring them — this is
 * the first backend module with a genuine runtime dependency on
 * `@autodeck/domain` (see apps/backend/package.json and the
 * transformIgnorePatterns note in jest.config.js / test/jest-e2e.json).
 *
 * `serviceIds` is an array because the domain pricing contract
 * (`computePriceSnapshot`) already takes an array of selected services, not
 * a single one — a booking may cover more than one service in one visit.
 *
 * `refundAmount`/`refundReason`/`cancelledAt`/`cancelledByStaffId` are only
 * ever set by `BookingsService.cancelBooking`, via
 * `calculateCancellationRefund` — never client input. Recording *what
 * refund is owed* is Phase 2E's job; actually paying it out through
 * Razorpay is explicitly Phase 2J's (see bookings.service.ts).
 */
export interface BookingRecord {
  bookingId: string; // backend-generated Firestore document ID
  customerId: string; // the URL's :customerId, never client body input
  vehicleId: string;
  serviceIds: string[];
  priceSnapshot: PriceSnapshot; // computed once at creation by computePriceSnapshot, never recomputed or client-supplied
  status: BookingStatus; // 'booked' at creation; only ever changed by BookingsService, never directly by a client value
  scheduledAt: FirebaseFirestore.Timestamp;
  refundAmount?: number;
  refundReason?: 'policy_24h' | 'studio_cancelled' | 'no_refund_window';
  cancelledAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  cancelledByStaffId?: string;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
}
