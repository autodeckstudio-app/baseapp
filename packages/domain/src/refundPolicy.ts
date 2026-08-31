export type CancellationInitiator = 'customer' | 'studio';

export interface RefundDecision {
  readonly refundAmount: number;
  readonly reason: 'policy_24h' | 'studio_cancelled' | 'no_refund_window';
}

/**
 * The cancellation-refund boundary. "More than 24 hours before" the
 * appointment gets a full refund; "within 24 hours" (i.e. <= 24h) does not —
 * matching the approved policy's exact wording. This function is the only
 * place that decision is made; it is never left to the client.
 */
export const CANCELLATION_REFUND_WINDOW_HOURS = 24;

/**
 * Computes the refund owed for a booking cancellation.
 *
 * Deliberately has no relationship to rescheduling: rescheduling is a
 * separate action (see the approved API design) that never calls this
 * function at all, which is what guarantees rescheduling can never
 * accidentally trigger a charge or refund.
 */
export function calculateCancellationRefund(params: {
  advanceAmount: number;
  scheduledAt: Date;
  now: Date;
  initiatedBy: CancellationInitiator;
}): Readonly<RefundDecision> {
  const { advanceAmount, scheduledAt, now, initiatedBy } = params;

  if (advanceAmount < 0) {
    throw new Error('advanceAmount cannot be negative');
  }

  if (initiatedBy === 'studio') {
    return Object.freeze({ refundAmount: advanceAmount, reason: 'studio_cancelled' as const });
  }

  const hoursUntilAppointment = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilAppointment > CANCELLATION_REFUND_WINDOW_HOURS) {
    return Object.freeze({ refundAmount: advanceAmount, reason: 'policy_24h' as const });
  }

  return Object.freeze({ refundAmount: 0, reason: 'no_refund_window' as const });
}
