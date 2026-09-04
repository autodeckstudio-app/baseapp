/**
 * Fixture data only. `BOOKING_STATUSES` mirrors
 * `packages/domain/src/types.ts` exactly — these 6 states, not AutoModz's
 * more granular lifecycle. `ALLOWED_BOOKING_TRANSITIONS`-equivalent logic
 * is not needed for a read-only mock list, so it isn't duplicated here.
 *
 * FUTURE SCHEMA DEPENDENCY: no customer-facing booking-read endpoint
 * exists yet (see the approved backend-architecture gate) — this file
 * stands in for that until it does.
 */
export const MOCK_BOOKING_STATUSES = [
  'booked',
  'in_progress',
  'approval_required',
  'completed',
  'sealed',
  'cancelled',
] as const;
export type MockBookingStatus = (typeof MOCK_BOOKING_STATUSES)[number];

export interface MockApprovalRequest {
  reason: string;
  priceDeltaPaise: number;
  timeDeltaMinutes: number;
}

export interface MockBooking {
  bookingId: string;
  vehicleId: string;
  serviceName: string;
  status: MockBookingStatus;
  scheduledAt: string;
  totalPaise: number;
  advanceRequired: boolean;
  advancePaise: number;
  approvalRequest?: MockApprovalRequest;
}

export const MOCK_BOOKINGS: MockBooking[] = [
  {
    bookingId: 'bkg-1',
    vehicleId: 'veh-1',
    serviceName: 'Ceramic Coating — Prolong',
    status: 'in_progress',
    scheduledAt: '2026-09-05T10:00:00+05:30',
    totalPaise: 1_000_000,
    advanceRequired: false,
    advancePaise: 0,
  },
  {
    bookingId: 'bkg-2',
    vehicleId: 'veh-2',
    serviceName: 'Premium Wash',
    status: 'sealed',
    scheduledAt: '2026-08-20T09:00:00+05:30',
    totalPaise: 100_000,
    advanceRequired: false,
    advancePaise: 0,
  },
  {
    bookingId: 'bkg-3',
    vehicleId: 'veh-2',
    serviceName: 'Detail Spa',
    status: 'approval_required',
    scheduledAt: '2026-09-06T11:00:00+05:30',
    totalPaise: 250_000,
    advanceRequired: false,
    advancePaise: 0,
    approvalRequest: {
      reason: 'Deep stain removal needed on the rear seat fabric, beyond the standard interior clean.',
      priceDeltaPaise: 60_000,
      timeDeltaMinutes: 45,
    },
  },
];

export function findMockBookingById(bookingId: string): MockBooking | undefined {
  return MOCK_BOOKINGS.find((booking) => booking.bookingId === bookingId);
}
