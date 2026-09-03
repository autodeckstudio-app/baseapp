import { ConflictException, NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type { BookingStatus } from '@autodeck/domain';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import type { BookingsService } from '../bookings/bookings.service';
import type { VisitsService } from '../visits/visits.service';
import { ApprovalsService } from './approvals.service';
import { RequestApprovalSchema, type RequestApprovalDto } from './dto/request-approval.dto';
import { ResolveApprovalSchema, type ResolveApprovalDto } from './dto/resolve-approval.dto';

type FakeBookingRecord = { bookingId: string; status: BookingStatus };
type FakeVisitRecord = { bookingId: string; customerId: string; status: BookingStatus };
type FakeApprovalRecord = { bookingId: string; visitId: string; decision: 'pending' | 'approved' | 'declined' };

function buildHarness(
  options: {
    existingApprovals?: Record<string, FakeApprovalRecord>;
    visit?: FakeVisitRecord | null;
    booking?: FakeBookingRecord | null;
  } = {},
) {
  const existingApprovals = options.existingApprovals ?? {};
  const visit =
    options.visit === undefined
      ? { bookingId: 'bk-1', customerId: 'cust-1', status: 'in_progress' as BookingStatus }
      : options.visit;
  const booking =
    options.booking === undefined ? { bookingId: 'bk-1', status: 'in_progress' as BookingStatus } : options.booking;

  const batch = {
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => {
      const docId = id ?? 'generated-approval-id';
      return {
        id: docId,
        get: jest.fn().mockResolvedValue({
          exists: name === 'approvals' && docId in existingApprovals,
          data: () => existingApprovals[docId],
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
  const visitsService = {
    getVisitRecord: jest.fn().mockResolvedValue(visit),
    updateStatusInBatch: jest.fn(),
  } as unknown as VisitsService;

  const service = new ApprovalsService(app, auditLogService, bookingsService, visitsService);
  return { service, batch, auditLogService, bookingsService, visitsService };
}

function actor(): AuthenticatedUser {
  return { uid: 'staff-1', role: 'staff' };
}

const requestInput: RequestApprovalDto = { description: 'Found a damaged part, needs replacement', additionalAmount: 250000 };

describe('RequestApprovalSchema', () => {
  it('accepts a valid payload', () => {
    expect(RequestApprovalSchema.safeParse(requestInput).success).toBe(true);
  });

  it('rejects invalid request data (empty description)', () => {
    expect(RequestApprovalSchema.safeParse({ ...requestInput, description: '' }).success).toBe(false);
  });

  it('rejects invalid request data (negative additionalAmount)', () => {
    expect(RequestApprovalSchema.safeParse({ ...requestInput, additionalAmount: -1 }).success).toBe(false);
  });

  it('has no visitId, bookingId, customerId, approvalId, or decision field for a client to set', () => {
    const parsed = RequestApprovalSchema.parse({
      ...requestInput,
      visitId: 'client-supplied',
      bookingId: 'client-supplied',
      customerId: 'attacker-controlled',
      approvalId: 'client-supplied',
      decision: 'approved',
    });
    expect(parsed).not.toHaveProperty('visitId');
    expect(parsed).not.toHaveProperty('bookingId');
    expect(parsed).not.toHaveProperty('customerId');
    expect(parsed).not.toHaveProperty('approvalId');
    expect(parsed).not.toHaveProperty('decision');
  });
});

describe('ResolveApprovalSchema', () => {
  it('accepts a valid payload', () => {
    const input: ResolveApprovalDto = { approved: true };
    expect(ResolveApprovalSchema.safeParse(input).success).toBe(true);
  });

  it('rejects invalid request data (non-boolean approved)', () => {
    expect(ResolveApprovalSchema.safeParse({ approved: 'yes' }).success).toBe(false);
  });

  it('has no decision, status, or refund/amount field for a client to set', () => {
    const parsed = ResolveApprovalSchema.parse({
      approved: true,
      decision: 'approved',
      status: 'in_progress',
      refundAmount: 999999,
      additionalAmount: 1,
    });
    expect(parsed).not.toHaveProperty('decision');
    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('refundAmount');
    expect(parsed).not.toHaveProperty('additionalAmount');
  });
});

describe('ApprovalsService.requestApproval', () => {
  it('creates a pending approval and moves the booking+visit to approval_required, in one batch', async () => {
    const { service, batch, bookingsService, visitsService } = buildHarness();
    const result = await service.requestApproval(actor(), 'visit-1', requestInput);

    expect(result.approvalId).toBe('generated-approval-id');
    expect(result.bookingId).toBe('bk-1');
    expect(result.visitId).toBe('visit-1');
    expect(result.customerId).toBe('cust-1');
    expect(result.decision).toBe('pending');
    expect(result.additionalAmount).toBe(250000);
    expect(batch.set).toHaveBeenCalled();
    expect(bookingsService.updateStatusInBatch).toHaveBeenCalledWith(batch, 'bk-1', 'approval_required');
    expect(visitsService.updateStatusInBatch).toHaveBeenCalledWith(batch, 'visit-1', 'approval_required');
    expect(batch.commit).toHaveBeenCalled();
  });

  it('throws NotFoundException when the visit does not exist, and writes nothing', async () => {
    const { service, batch, auditLogService, bookingsService, visitsService } = buildHarness({ visit: null });
    await expect(service.requestApproval(actor(), 'ghost', requestInput)).rejects.toBeInstanceOf(NotFoundException);
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
    expect(bookingsService.updateStatusInBatch).not.toHaveBeenCalled();
    expect(visitsService.updateStatusInBatch).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the underlying booking does not exist, and writes nothing', async () => {
    const { service, batch, auditLogService } = buildHarness({ booking: null });
    await expect(service.requestApproval(actor(), 'visit-1', requestInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(batch.set).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it.each<BookingStatus>(['booked', 'approval_required', 'completed', 'sealed', 'cancelled'])(
    'rejects requesting approval for a booking in status "%s", via the existing state machine, and writes nothing',
    async (status) => {
      const { service, batch, auditLogService, bookingsService, visitsService } = buildHarness({
        booking: { bookingId: 'bk-1', status },
      });
      await expect(service.requestApproval(actor(), 'visit-1', requestInput)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(batch.set).not.toHaveBeenCalled();
      expect(batch.commit).not.toHaveBeenCalled();
      expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
      expect(bookingsService.updateStatusInBatch).not.toHaveBeenCalled();
      expect(visitsService.updateStatusInBatch).not.toHaveBeenCalled();
    },
  );

  it('writes an audit entry sourced from the authenticated actor', async () => {
    const { service, batch, auditLogService } = buildHarness();
    await service.requestApproval(actor(), 'visit-1', requestInput);

    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'approval.request',
        entityId: 'generated-approval-id',
        after: expect.objectContaining({ bookingId: 'bk-1', visitId: 'visit-1', additionalAmount: 250000 }),
      }),
    );
  });
});

describe('ApprovalsService.resolveApproval', () => {
  const resolveInput: ResolveApprovalDto = { approved: true };

  it('throws NotFoundException for a nonexistent approval', async () => {
    const { service } = buildHarness();
    await expect(service.resolveApproval(actor(), 'ghost', resolveInput)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves as approved and resumes the booking+visit to in_progress, in one batch', async () => {
    const { service, batch, bookingsService, visitsService } = buildHarness({
      existingApprovals: { 'appr-1': { bookingId: 'bk-1', visitId: 'visit-1', decision: 'pending' } },
      booking: { bookingId: 'bk-1', status: 'approval_required' },
    });

    await service.resolveApproval(actor(), 'appr-1', { approved: true });

    expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ decision: 'approved' }));
    expect(bookingsService.updateStatusInBatch).toHaveBeenCalledWith(batch, 'bk-1', 'in_progress');
    expect(visitsService.updateStatusInBatch).toHaveBeenCalledWith(batch, 'visit-1', 'in_progress');
    expect(batch.commit).toHaveBeenCalled();
  });

  it('resolves as declined and STILL resumes the booking+visit to in_progress — the only transition the existing state machine allows out of approval_required', async () => {
    const { service, batch, bookingsService, visitsService } = buildHarness({
      existingApprovals: { 'appr-1': { bookingId: 'bk-1', visitId: 'visit-1', decision: 'pending' } },
      booking: { bookingId: 'bk-1', status: 'approval_required' },
    });

    await service.resolveApproval(actor(), 'appr-1', { approved: false });

    expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ decision: 'declined' }));
    expect(bookingsService.updateStatusInBatch).toHaveBeenCalledWith(batch, 'bk-1', 'in_progress');
    expect(visitsService.updateStatusInBatch).toHaveBeenCalledWith(batch, 'visit-1', 'in_progress');
  });

  it('rejects resolving an approval that is already resolved — replay protection', async () => {
    const { service, batch, auditLogService, bookingsService, visitsService } = buildHarness({
      existingApprovals: { 'appr-1': { bookingId: 'bk-1', visitId: 'visit-1', decision: 'approved' } },
      booking: { bookingId: 'bk-1', status: 'in_progress' },
    });

    await expect(service.resolveApproval(actor(), 'appr-1', resolveInput)).rejects.toBeInstanceOf(ConflictException);
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
    expect(bookingsService.updateStatusInBatch).not.toHaveBeenCalled();
    expect(visitsService.updateStatusInBatch).not.toHaveBeenCalled();
  });

  // 'booked' is deliberately excluded from this list:
  // ALLOWED_BOOKING_TRANSITIONS['booked'] includes 'in_progress' in the
  // existing, unmodified domain table, so isValidBookingTransition
  // correctly allows it — this is not a realistic state for a pending
  // approval to be in (nothing transitions a booking backward to 'booked'),
  // but the check itself is honestly permissive about it, matching the
  // domain function exactly rather than adding an extra hand-written
  // restriction not present in the table.
  it.each<BookingStatus>(['in_progress', 'completed', 'sealed', 'cancelled'])(
    'rejects resolving a pending approval whose booking has moved to status "%s" — sealed/cancelled/etc immutability via the existing state machine',
    async (status) => {
      const { service, batch, auditLogService, bookingsService, visitsService } = buildHarness({
        existingApprovals: { 'appr-1': { bookingId: 'bk-1', visitId: 'visit-1', decision: 'pending' } },
        booking: { bookingId: 'bk-1', status },
      });
      await expect(service.resolveApproval(actor(), 'appr-1', resolveInput)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(batch.update).not.toHaveBeenCalled();
      expect(batch.commit).not.toHaveBeenCalled();
      expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
      expect(bookingsService.updateStatusInBatch).not.toHaveBeenCalled();
      expect(visitsService.updateStatusInBatch).not.toHaveBeenCalled();
    },
  );

  it('ignores a client-injected decision/status even if smuggled onto the input object', async () => {
    const { service, batch } = buildHarness({
      existingApprovals: { 'appr-1': { bookingId: 'bk-1', visitId: 'visit-1', decision: 'pending' } },
      booking: { bookingId: 'bk-1', status: 'approval_required' },
    });
    const tampered = { approved: true, decision: 'declined' } as unknown as ResolveApprovalDto;

    await service.resolveApproval(actor(), 'appr-1', tampered);
    expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ decision: 'approved' }));
  });

  it('writes an audit entry with accurate before/after decision', async () => {
    const { service, batch, auditLogService } = buildHarness({
      existingApprovals: { 'appr-1': { bookingId: 'bk-1', visitId: 'visit-1', decision: 'pending' } },
      booking: { bookingId: 'bk-1', status: 'approval_required' },
    });

    await service.resolveApproval(actor(), 'appr-1', { approved: true });

    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'approval.resolve',
        entityId: 'appr-1',
        before: { decision: 'pending' },
        after: { decision: 'approved' },
      }),
    );
  });
});
