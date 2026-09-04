import type { BookingStatus } from '@autodeck/domain';

/**
 * Fixture data mirroring REAL backend-local shapes — not invented models.
 *
 * `MockJob` combines fields from two actual backend types that are not
 * (yet) exported from `@autodeck/domain` (they live only in
 * `apps/backend/src/visits/visits.types.ts` and
 * `apps/backend/src/bookings/...`): a Visit tracks the shop-floor
 * lifecycle of one Booking, one-to-one. `status` is the real
 * `BookingStatus` type (`booked|in_progress|approval_required|completed|
 * sealed|cancelled`) — never an invented AutoModz-style lifecycle.
 *
 * FUTURE INTEGRATION: in production, Studio reads `visits/{id}` and
 * `bookings/{id}` directly against Firestore (per `firestore.rules`,
 * `isStaffPlus()`), joined client-side. This fixture stands in for that
 * join. `assignedStaffName` and `bay` are UI-only placeholders — there is
 * NO staff-assignment or bay/work-location field anywhere in the current
 * domain or backend (confirmed in the Studio+Admin audit); they are
 * included here, clearly marked, only because the brief explicitly
 * permits fixture use for this with clear isolation. Wiring either for
 * real requires a schema decision this UI pass does not make.
 */
export interface MockApprovalRequest {
  approvalId: string;
  description: string;
  additionalAmountPaise: number;
  decision: 'pending' | 'approved' | 'declined';
}

export interface MockJob {
  visitId: string;
  bookingId: string;
  customerId: string;
  vehicleId: string;
  serviceName: string;
  status: BookingStatus;
  scheduledAt: string;
  totalPaise: number;
  advanceRequired: boolean;
  advancePaise: number;
  /** UI-only placeholder — no backend field exists yet. See file doc comment. */
  bay?: string;
  /** UI-only placeholder — no backend field exists yet. See file doc comment. */
  assignedStaffName?: string;
  approval?: MockApprovalRequest;
}

export const MOCK_JOBS: MockJob[] = [
  {
    visitId: 'visit-1',
    bookingId: 'bkg-1',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    serviceName: 'Ceramic Coating — Prolong',
    status: 'in_progress',
    scheduledAt: '2026-09-05T10:00:00+05:30',
    totalPaise: 1_000_000,
    advanceRequired: false,
    advancePaise: 0,
    bay: 'Protection Bay 1',
    assignedStaffName: 'Vikram Rao',
  },
  {
    visitId: 'visit-2',
    bookingId: 'bkg-2',
    customerId: 'cust-2',
    vehicleId: 'veh-2',
    serviceName: 'Premium Wash',
    status: 'booked',
    scheduledAt: '2026-09-05T13:00:00+05:30',
    totalPaise: 100_000,
    advanceRequired: false,
    advancePaise: 0,
    bay: 'Wash Bay 2',
  },
  {
    visitId: 'visit-3',
    bookingId: 'bkg-3',
    customerId: 'cust-2',
    vehicleId: 'veh-2',
    serviceName: 'Detail Spa',
    status: 'approval_required',
    scheduledAt: '2026-09-05T09:00:00+05:30',
    totalPaise: 250_000,
    advanceRequired: false,
    advancePaise: 0,
    bay: 'Wash Bay 1',
    assignedStaffName: 'Vikram Rao',
    approval: {
      approvalId: 'appr-1',
      description: 'Deep stain removal needed on the rear seat fabric, beyond the standard interior clean.',
      additionalAmountPaise: 60_000,
      decision: 'pending',
    },
  },
  {
    visitId: 'visit-4',
    bookingId: 'bkg-4',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    serviceName: 'Glass Coating',
    status: 'completed',
    scheduledAt: '2026-09-04T15:00:00+05:30',
    totalPaise: 120_000,
    advanceRequired: false,
    advancePaise: 0,
  },
  {
    visitId: 'visit-5',
    bookingId: 'bkg-5',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    serviceName: 'Regular Wash',
    status: 'sealed',
    scheduledAt: '2026-09-03T11:00:00+05:30',
    totalPaise: 50_000,
    advanceRequired: false,
    advancePaise: 0,
  },
];

export function findMockJobByVisitId(visitId: string): MockJob | undefined {
  return MOCK_JOBS.find((job) => job.visitId === visitId);
}
