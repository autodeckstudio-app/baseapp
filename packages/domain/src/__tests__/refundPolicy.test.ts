import { calculateCancellationRefund } from '../refundPolicy';

const ADVANCE = 600_000; // ₹6,000

describe('calculateCancellationRefund', () => {
  it('refunds in full when a customer cancels more than 24 hours before the appointment', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const scheduledAt = new Date('2026-01-02T13:00:00Z'); // 25 hours out
    const decision = calculateCancellationRefund({
      advanceAmount: ADVANCE,
      scheduledAt,
      now,
      initiatedBy: 'customer',
    });
    expect(decision.refundAmount).toBe(ADVANCE);
    expect(decision.reason).toBe('policy_24h');
  });

  it('refunds nothing when a customer cancels exactly at the 24-hour boundary', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const scheduledAt = new Date('2026-01-02T12:00:00Z'); // exactly 24 hours out
    const decision = calculateCancellationRefund({
      advanceAmount: ADVANCE,
      scheduledAt,
      now,
      initiatedBy: 'customer',
    });
    expect(decision.refundAmount).toBe(0);
    expect(decision.reason).toBe('no_refund_window');
  });

  it('refunds nothing when a customer cancels well within 24 hours', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const scheduledAt = new Date('2026-01-01T18:00:00Z'); // 6 hours out
    const decision = calculateCancellationRefund({
      advanceAmount: ADVANCE,
      scheduledAt,
      now,
      initiatedBy: 'customer',
    });
    expect(decision.refundAmount).toBe(0);
    expect(decision.reason).toBe('no_refund_window');
  });

  it('always refunds in full for a studio-initiated cancellation, even inside 24 hours', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const scheduledAt = new Date('2026-01-01T13:00:00Z'); // 1 hour out
    const decision = calculateCancellationRefund({
      advanceAmount: ADVANCE,
      scheduledAt,
      now,
      initiatedBy: 'studio',
    });
    expect(decision.refundAmount).toBe(ADVANCE);
    expect(decision.reason).toBe('studio_cancelled');
  });

  it('rejects a negative advance amount', () => {
    expect(() =>
      calculateCancellationRefund({
        advanceAmount: -1,
        scheduledAt: new Date(),
        now: new Date(),
        initiatedBy: 'customer',
      })
    ).toThrow();
  });

  it('freezes the returned decision', () => {
    const decision = calculateCancellationRefund({
      advanceAmount: ADVANCE,
      scheduledAt: new Date('2026-01-02T13:00:00Z'),
      now: new Date('2026-01-01T12:00:00Z'),
      initiatedBy: 'customer',
    });
    expect(Object.isFrozen(decision)).toBe(true);
  });
});
