import type { BookingStatus } from '@autodeck/domain';
import { Badge } from '../primitives';

const TONE: Record<BookingStatus, 'neutral' | 'accent' | 'warning' | 'success' | 'danger'> = {
  booked: 'neutral',
  in_progress: 'accent',
  approval_required: 'warning',
  completed: 'success',
  sealed: 'success',
  cancelled: 'danger',
};

/** Consistent status-colour mapping, reused across Overview/Bookings/Customers/Vehicles — one source of truth for the semantic-colour rule. */
export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge label={status.replace('_', ' ')} tone={TONE[status]} />;
}
