import { ConflictException, NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type { BookingStatus } from '@autodeck/domain';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import type { BookingsService } from '../bookings/bookings.service';
import { VisitsService } from './visits.service';

type FakeBookingRecord = { bookingId: string; customerId: string; vehicleId: string; status: BookingStatus };
type FakeVisitRecord = { bookingId: string; status: BookingStatus };

function buildHarness(
  options: {
    existingVisits?: Record<string, FakeVisitRecord>;
    booking?: FakeBookingRecord | null;
  } = {},
) {
  const existingVisits = options.existingVisits ?? {};
  const booking =
    options.booking === undefined
      ? { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status: 'booked' as BookingStatus }
      : options.booking;

  const batch = {
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => {
      const docId = id ?? 'generated-visit-id';
      return {
        id: docId,
        get: jest.fn().mockResolvedValue({
          exists: name === 'visits' && docId in existingVisits,
          data: () => existingVisits[docId],
        }),
      };
    }),
  }));

  const firestoreMock = { collection: collectionMock, batch: jest.fn(() => batch) };
  const app = { firestore: () => firestoreMock } as unknown as admin.app.App;
  const auditLogService = { recordInBatch: jest.fn(), record: jest.fn() } as unknown as AuditLogService;
  const bookingsService = {
    getBookingRecord: jest.fn().mockResolvedValue(booking),
    updateStatusInBatch: jest.fn(),
  } as unknown as BookingsService;

  const service = new VisitsService(app, auditLogService, bookingsService);
  return { service, batch, auditLogService, bookingsService };
}

function actor(): AuthenticatedUser {
  return { uid: 'staff-1', role: 'staff' };
}

describe('VisitsService.checkIn', () => {
  it('creates an in_progress visit and advances the booking to in_progress, in one batch', async () => {
    const { service, batch, bookingsService } = buildHarness();
    const result = await service.checkIn(actor(), 'bk-1');

    expect(result.visitId).toBe('generated-visit-id');
    expect(result.bookingId).toBe('bk-1');
    expect(result.customerId).toBe('cust-1');
    expect(result.vehicleId).toBe('veh-1');
    expect(result.status).toBe('in_progress');
    expect(batch.set).toHaveBeenCalled();
    expect(bookingsService.updateStatusInBatch).toHaveBeenCalledWith(batch, 'bk-1', 'in_progress');
    expect(batch.commit).toHaveBeenCalled();
  });

  it('throws NotFoundException when the booking does not exist, and writes nothing', async () => {
    const { service, batch, auditLogService, bookingsService } = buildHarness({ booking: null });
    await expect(service.checkIn(actor(), 'ghost')).rejects.toBeInstanceOf(NotFoundException);
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
    expect(bookingsService.updateStatusInBatch).not.toHaveBeenCalled();
  });

  // 'approval_required' is deliberately excluded from this list:
  // ALLOWED_BOOKING_TRANSITIONS['approval_required'] is ['in_progress'] in
  // the existing, unmodified domain state machine (resuming a paused visit
  // after an approval is granted) — so isValidBookingTransition correctly
  // allows it, and checkIn correctly defers to that. Nothing in the current
  // system can ever put a booking into 'approval_required' yet (that
  // transition itself is Phase 2G's ApprovalsModule, not built), so this
  // path is unreachable today — see the dedicated test below.
  it.each<BookingStatus>(['in_progress', 'completed', 'sealed', 'cancelled'])(
    'rejects starting a visit for a booking already in status "%s", via the existing state machine, and writes nothing',
    async (status) => {
      const { service, batch, auditLogService, bookingsService } = buildHarness({
        booking: { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status },
      });
      await expect(service.checkIn(actor(), 'bk-1')).rejects.toBeInstanceOf(ConflictException);
      expect(batch.set).not.toHaveBeenCalled();
      expect(batch.commit).not.toHaveBeenCalled();
      expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
      expect(bookingsService.updateStatusInBatch).not.toHaveBeenCalled();
    },
  );

  it('allows checkIn from approval_required, per the existing state machine (unreachable today since nothing yet transitions a booking into that status)', async () => {
    const { service, bookingsService } = buildHarness({
      booking: { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status: 'approval_required' },
    });
    const result = await service.checkIn(actor(), 'bk-1');
    expect(result.status).toBe('in_progress');
    expect(bookingsService.updateStatusInBatch).toHaveBeenCalledWith(expect.anything(), 'bk-1', 'in_progress');
  });

  it('writes an audit entry sourced from the authenticated actor', async () => {
    const { service, batch, auditLogService } = buildHarness();
    await service.checkIn(actor(), 'bk-1');

    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'visit.check_in',
        entityId: 'generated-visit-id',
        after: { bookingId: 'bk-1', status: 'in_progress' },
      }),
    );
  });
});

describe('VisitsService.complete', () => {
  it('throws NotFoundException for a nonexistent visit', async () => {
    const { service } = buildHarness();
    await expect(service.complete(actor(), 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('completes the visit and advances the booking to completed, in one batch', async () => {
    const { service, batch, bookingsService } = buildHarness({
      existingVisits: { 'visit-1': { bookingId: 'bk-1', status: 'in_progress' } },
      booking: { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status: 'in_progress' },
    });

    await service.complete(actor(), 'visit-1');

    expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'completed' }));
    expect(bookingsService.updateStatusInBatch).toHaveBeenCalledWith(batch, 'bk-1', 'completed');
    expect(batch.commit).toHaveBeenCalled();
  });

  it.each<BookingStatus>(['booked', 'approval_required', 'completed', 'sealed', 'cancelled'])(
    'rejects completing a visit whose booking is in status "%s", via the existing state machine, and writes nothing',
    async (status) => {
      const { service, batch, auditLogService, bookingsService } = buildHarness({
        existingVisits: { 'visit-1': { bookingId: 'bk-1', status } },
        booking: { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status },
      });
      await expect(service.complete(actor(), 'visit-1')).rejects.toBeInstanceOf(ConflictException);
      expect(batch.update).not.toHaveBeenCalled();
      expect(batch.commit).not.toHaveBeenCalled();
      expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
      expect(bookingsService.updateStatusInBatch).not.toHaveBeenCalled();
    },
  );

  it('writes an audit entry with accurate before/after status', async () => {
    const { service, batch, auditLogService } = buildHarness({
      existingVisits: { 'visit-1': { bookingId: 'bk-1', status: 'in_progress' } },
      booking: { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status: 'in_progress' },
    });

    await service.complete(actor(), 'visit-1');

    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'visit.complete',
        entityId: 'visit-1',
        before: { status: 'in_progress' },
        after: { status: 'completed' },
      }),
    );
  });
});

describe('VisitsService.seal', () => {
  it('throws NotFoundException for a nonexistent visit', async () => {
    const { service } = buildHarness();
    await expect(service.seal(actor(), 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seals the visit and advances the booking to sealed, in one batch', async () => {
    const { service, batch, bookingsService } = buildHarness({
      existingVisits: { 'visit-1': { bookingId: 'bk-1', status: 'completed' } },
      booking: { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status: 'completed' },
    });

    await service.seal(actor(), 'visit-1');

    expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'sealed' }));
    expect(bookingsService.updateStatusInBatch).toHaveBeenCalledWith(batch, 'bk-1', 'sealed');
    expect(batch.commit).toHaveBeenCalled();
  });

  it.each<BookingStatus>(['booked', 'in_progress', 'approval_required', 'cancelled'])(
    'rejects sealing a visit whose booking is in status "%s", via the existing state machine, and writes nothing',
    async (status) => {
      const { service, batch, auditLogService, bookingsService } = buildHarness({
        existingVisits: { 'visit-1': { bookingId: 'bk-1', status } },
        booking: { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status },
      });
      await expect(service.seal(actor(), 'visit-1')).rejects.toBeInstanceOf(ConflictException);
      expect(batch.update).not.toHaveBeenCalled();
      expect(batch.commit).not.toHaveBeenCalled();
      expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
      expect(bookingsService.updateStatusInBatch).not.toHaveBeenCalled();
    },
  );

  it('rejects re-sealing an already-sealed visit — sealed immutability falls out of the same state-machine check', async () => {
    const { service, batch, auditLogService } = buildHarness({
      existingVisits: { 'visit-1': { bookingId: 'bk-1', status: 'sealed' } },
      booking: { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status: 'sealed' },
    });

    await expect(service.seal(actor(), 'visit-1')).rejects.toBeInstanceOf(ConflictException);
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('rejects any further complete() call against an already-sealed booking too', async () => {
    const { service, batch, auditLogService } = buildHarness({
      existingVisits: { 'visit-1': { bookingId: 'bk-1', status: 'sealed' } },
      booking: { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status: 'sealed' },
    });

    await expect(service.complete(actor(), 'visit-1')).rejects.toBeInstanceOf(ConflictException);
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('writes an audit entry with accurate before/after status', async () => {
    const { service, batch, auditLogService } = buildHarness({
      existingVisits: { 'visit-1': { bookingId: 'bk-1', status: 'completed' } },
      booking: { bookingId: 'bk-1', customerId: 'cust-1', vehicleId: 'veh-1', status: 'completed' },
    });

    await service.seal(actor(), 'visit-1');

    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'visit.seal',
        entityId: 'visit-1',
        before: { status: 'completed' },
        after: { status: 'sealed' },
      }),
    );
  });
});
