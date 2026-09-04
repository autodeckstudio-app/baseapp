import type { BookingStatus } from '@autodeck/domain';

/**
 * Fixture data. `status` uses the REAL `BookingStatus` type from
 * `@autodeck/domain` — never an invented lifecycle. Denormalized display
 * fields (customer/vehicle/service names) stand in for the client-side
 * join Admin performs against direct-Firestore reads in production.
 */
export interface MockBookingRow {
  bookingId: string;
  customerId: string;
  vehicleId: string;
  serviceName: string;
  scheduledAt: string;
  status: BookingStatus;
  totalPaise: number;
  paymentStatus: 'not_required' | 'pending' | 'paid';
}

export const MOCK_BOOKINGS: MockBookingRow[] = [
  { bookingId: 'bkg-1', customerId: 'cust-1', vehicleId: 'veh-1', serviceName: 'Ceramic Coating — Prolong', scheduledAt: '2026-09-05T10:00:00+05:30', status: 'in_progress', totalPaise: 1_000_000, paymentStatus: 'pending' },
  { bookingId: 'bkg-2', customerId: 'cust-2', vehicleId: 'veh-2', serviceName: 'Premium Wash', scheduledAt: '2026-09-05T13:00:00+05:30', status: 'booked', totalPaise: 100_000, paymentStatus: 'not_required' },
  { bookingId: 'bkg-3', customerId: 'cust-2', vehicleId: 'veh-2', serviceName: 'Detail Spa', scheduledAt: '2026-09-05T09:00:00+05:30', status: 'approval_required', totalPaise: 250_000, paymentStatus: 'not_required' },
  { bookingId: 'bkg-4', customerId: 'cust-3', vehicleId: 'veh-3', serviceName: 'Glass Coating', scheduledAt: '2026-09-04T15:00:00+05:30', status: 'completed', totalPaise: 120_000, paymentStatus: 'paid' },
  { bookingId: 'bkg-5', customerId: 'cust-1', vehicleId: 'veh-1', serviceName: 'Regular Wash', scheduledAt: '2026-09-03T11:00:00+05:30', status: 'sealed', totalPaise: 50_000, paymentStatus: 'paid' },
];
