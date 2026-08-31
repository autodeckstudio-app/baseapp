import type { BookingStatus } from './types';

/**
 * The single source of truth for which booking-status transitions are
 * legal. Both the backend and the Firestore security rules are meant to
 * enforce exactly this table (per the approved design) — this is the
 * canonical definition either implementation checks itself against.
 */
export const ALLOWED_BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> =
  Object.freeze({
    booked: ['in_progress', 'cancelled'],
    in_progress: ['approval_required', 'completed', 'cancelled'],
    approval_required: ['in_progress'],
    completed: ['sealed'],
    sealed: [],
    cancelled: [],
  });

export function isValidBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_BOOKING_TRANSITIONS[from].includes(to);
}
