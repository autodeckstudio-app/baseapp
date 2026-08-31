import { isValidBookingTransition } from '../stateMachine';
import type { BookingStatus } from '../types';
import { BOOKING_STATUSES } from '../types';

describe('isValidBookingTransition', () => {
  it('allows booked -> in_progress', () => {
    expect(isValidBookingTransition('booked', 'in_progress')).toBe(true);
  });

  it('allows booked -> cancelled', () => {
    expect(isValidBookingTransition('booked', 'cancelled')).toBe(true);
  });

  it('rejects booked -> completed (cannot skip stages)', () => {
    expect(isValidBookingTransition('booked', 'completed')).toBe(false);
  });

  it('allows in_progress -> approval_required', () => {
    expect(isValidBookingTransition('in_progress', 'approval_required')).toBe(true);
  });

  it('allows in_progress -> completed', () => {
    expect(isValidBookingTransition('in_progress', 'completed')).toBe(true);
  });

  it('allows in_progress -> cancelled', () => {
    expect(isValidBookingTransition('in_progress', 'cancelled')).toBe(true);
  });

  it('allows approval_required -> in_progress (resuming after a decision)', () => {
    expect(isValidBookingTransition('approval_required', 'in_progress')).toBe(true);
  });

  it('rejects approval_required -> completed (must resolve the approval first)', () => {
    expect(isValidBookingTransition('approval_required', 'completed')).toBe(false);
  });

  it('allows completed -> sealed', () => {
    expect(isValidBookingTransition('completed', 'sealed')).toBe(true);
  });

  it('rejects completed -> cancelled (cannot cancel after completion)', () => {
    expect(isValidBookingTransition('completed', 'cancelled')).toBe(false);
  });

  it('rejects every transition out of sealed — it is terminal, with no exceptions', () => {
    for (const to of BOOKING_STATUSES) {
      expect(isValidBookingTransition('sealed', to as BookingStatus)).toBe(false);
    }
  });

  it('rejects every transition out of cancelled — it is terminal', () => {
    for (const to of BOOKING_STATUSES) {
      expect(isValidBookingTransition('cancelled', to as BookingStatus)).toBe(false);
    }
  });
});
