import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type Razorpay from 'razorpay';
import type { BookingStatus } from '@autodeck/domain';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import type { BookingsService } from '../bookings/bookings.service';
import { PaymentsService } from './payments.service';

type FakeBooking = {
  bookingId: string;
  customerId: string;
  status: BookingStatus;
  priceSnapshot: { advanceRequired: boolean; advanceAmount: number };
  refundAmount?: number;
};

const defaultBooking: FakeBooking = {
  bookingId: 'bk-1',
  customerId: 'cust-1',
  status: 'booked',
  priceSnapshot: { advanceRequired: true, advanceAmount: 600000 },
};

function existsError(): Error {
  return Object.assign(new Error('ALREADY_EXISTS'), { code: 6 });
}

function buildHarness(
  options: {
    booking?: FakeBooking | null;
    existingPayment?: Record<string, unknown> | null;
    existingRefund?: Record<string, unknown> | null;
    orderCreateImpl?: jest.Mock;
    refundImpl?: jest.Mock;
  } = {},
) {
  const booking = options.booking === undefined ? defaultBooking : options.booking;
  let paymentStore: Record<string, unknown> | null = options.existingPayment ?? null;
  let refundStore: Record<string, unknown> | null = options.existingRefund ?? null;

  const paymentDocRef = {
    get: jest.fn(async () => ({ exists: paymentStore !== null, data: () => paymentStore })),
    create: jest.fn(async (data: Record<string, unknown>) => {
      if (paymentStore !== null) throw existsError();
      paymentStore = { ...data };
    }),
    update: jest.fn(async (data: Record<string, unknown>) => {
      paymentStore = { ...paymentStore, ...data };
    }),
    delete: jest.fn(async () => {
      paymentStore = null;
    }),
  };

  const refundDocRef = {
    get: jest.fn(async () => ({ exists: refundStore !== null, data: () => refundStore })),
    create: jest.fn(async (data: Record<string, unknown>) => {
      if (refundStore !== null) throw existsError();
      refundStore = { ...data };
    }),
    update: jest.fn(async (data: Record<string, unknown>) => {
      refundStore = { ...refundStore, ...data };
    }),
  };

  const batch = { update: jest.fn(), set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn(() => {
      if (name === 'payments') return paymentDocRef;
      if (name === 'refunds') return refundDocRef;
      throw new Error(`unexpected collection in test: ${name}`);
    }),
  }));

  const firestoreMock = { collection: collectionMock, batch: jest.fn(() => batch) };
  const app = { firestore: () => firestoreMock } as unknown as admin.app.App;
  const auditLogService = {
    record: jest.fn().mockResolvedValue('audit-id'),
    recordInBatch: jest.fn(),
    recordInTransaction: jest.fn(),
  } as unknown as AuditLogService;
  const bookingsService = { getBookingRecord: jest.fn().mockResolvedValue(booking) } as unknown as BookingsService;
  const razorpay = {
    orders: { create: options.orderCreateImpl ?? jest.fn().mockResolvedValue({ id: 'order_test123' }) },
    payments: { refund: options.refundImpl ?? jest.fn().mockResolvedValue({ id: 'rfnd_test123', status: 'processed' }) },
  } as unknown as Razorpay;

  const service = new PaymentsService(app, razorpay, auditLogService, bookingsService);
  return { service, paymentDocRef, refundDocRef, batch, auditLogService, bookingsService, razorpay };
}

function actor(role: AuthenticatedUser['role'] = 'staff'): AuthenticatedUser {
  return { uid: role === 'studio_manager' ? 'manager-1' : 'staff-1', role };
}

describe('PaymentsService.createPaymentOrder', () => {
  it('creates a Razorpay order and stores the payment record keyed by bookingId', async () => {
    const { service, razorpay } = buildHarness();
    const result = await service.createPaymentOrder(actor(), 'bk-1');

    expect(result.paymentId).toBe('bk-1');
    expect(result.bookingId).toBe('bk-1');
    expect(result.customerId).toBe('cust-1');
    expect(result.amount).toBe(600000);
    expect(result.razorpayOrderId).toBe('order_test123');
    expect(result.status).toBe('created');
    expect(razorpay.orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 600000, currency: 'INR', receipt: 'bk-1' }),
    );
  });

  it('throws NotFoundException when the booking does not exist, and never calls Razorpay', async () => {
    const { service, razorpay } = buildHarness({ booking: null });
    await expect(service.createPaymentOrder(actor(), 'ghost')).rejects.toBeInstanceOf(NotFoundException);
    expect(razorpay.orders.create).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the booking does not require an advance, and never calls Razorpay', async () => {
    const { service, razorpay } = buildHarness({
      booking: { ...defaultBooking, priceSnapshot: { advanceRequired: false, advanceAmount: 0 } },
    });
    await expect(service.createPaymentOrder(actor(), 'bk-1')).rejects.toBeInstanceOf(ConflictException);
    expect(razorpay.orders.create).not.toHaveBeenCalled();
  });

  it('rejects creating a second payment order for the same booking, and never calls Razorpay again — idempotency guard fires before any API call', async () => {
    const { service, razorpay } = buildHarness({
      existingPayment: { paymentId: 'bk-1', bookingId: 'bk-1', status: 'created', razorpayOrderId: 'order_existing' },
    });
    await expect(service.createPaymentOrder(actor(), 'bk-1')).rejects.toBeInstanceOf(ConflictException);
    expect(razorpay.orders.create).not.toHaveBeenCalled();
  });

  it('releases the claim (deletes the payment doc) if the Razorpay API call fails, allowing a retry', async () => {
    const failingCreate = jest.fn().mockRejectedValue(new Error('network error'));
    const { service, paymentDocRef } = buildHarness({ orderCreateImpl: failingCreate });

    await expect(service.createPaymentOrder(actor(), 'bk-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(paymentDocRef.delete).toHaveBeenCalled();
  });

  it('writes an audit entry sourced from the authenticated actor', async () => {
    const { service, auditLogService } = buildHarness();
    await service.createPaymentOrder(actor(), 'bk-1');

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'payment.order_create',
        entityId: 'bk-1',
      }),
    );
  });
});

describe('PaymentsService.processRefund', () => {
  const cancelledBookingWithRefund: FakeBooking = {
    bookingId: 'bk-1',
    customerId: 'cust-1',
    status: 'cancelled',
    priceSnapshot: { advanceRequired: true, advanceAmount: 600000 },
    refundAmount: 600000,
  };
  const capturedPayment = {
    paymentId: 'bk-1',
    bookingId: 'bk-1',
    razorpayPaymentId: 'pay_test123',
    status: 'captured',
  };

  it('throws NotFoundException when the booking does not exist', async () => {
    const { service } = buildHarness({ booking: null });
    await expect(service.processRefund(actor('studio_manager'), 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException when the booking is not cancelled', async () => {
    const { service } = buildHarness({ booking: { ...defaultBooking, status: 'booked' } });
    await expect(service.processRefund(actor('studio_manager'), 'bk-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ConflictException when no refund is owed', async () => {
    const { service } = buildHarness({ booking: { ...cancelledBookingWithRefund, refundAmount: 0 } });
    await expect(service.processRefund(actor('studio_manager'), 'bk-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException when no payment record exists for the booking', async () => {
    const { service } = buildHarness({ booking: cancelledBookingWithRefund });
    await expect(service.processRefund(actor('studio_manager'), 'bk-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException when the payment has not been captured', async () => {
    const { service } = buildHarness({
      booking: cancelledBookingWithRefund,
      existingPayment: { ...capturedPayment, status: 'created' },
    });
    await expect(service.processRefund(actor('studio_manager'), 'bk-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('issues the refund via Razorpay using the payment amount from the booking, never a client-supplied value', async () => {
    const { service, razorpay } = buildHarness({
      booking: cancelledBookingWithRefund,
      existingPayment: capturedPayment,
    });
    const result = await service.processRefund(actor('studio_manager'), 'bk-1');

    expect(razorpay.payments.refund).toHaveBeenCalledWith('pay_test123', { amount: 600000 });
    expect(result.refundId).toBe('bk-1');
    expect(result.amount).toBe(600000);
    expect(result.razorpayRefundId).toBe('rfnd_test123');
    expect(result.status).toBe('processed');
  });

  it('marks the underlying payment as refunded', async () => {
    const { service, batch } = buildHarness({
      booking: cancelledBookingWithRefund,
      existingPayment: capturedPayment,
    });
    await service.processRefund(actor('studio_manager'), 'bk-1');

    expect(batch.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'refunded' }),
    );
  });

  it('rejects processing a refund that is already being processed, and never calls Razorpay again', async () => {
    const { service, razorpay } = buildHarness({
      booking: cancelledBookingWithRefund,
      existingPayment: capturedPayment,
      existingRefund: { refundId: 'bk-1', status: 'processing' },
    });
    await expect(service.processRefund(actor('studio_manager'), 'bk-1')).rejects.toBeInstanceOf(ConflictException);
    expect(razorpay.payments.refund).not.toHaveBeenCalled();
  });

  it('rejects processing a refund that has already been processed, and never calls Razorpay again', async () => {
    const { service, razorpay } = buildHarness({
      booking: cancelledBookingWithRefund,
      existingPayment: capturedPayment,
      existingRefund: { refundId: 'bk-1', status: 'processed', razorpayRefundId: 'rfnd_old' },
    });
    await expect(service.processRefund(actor('studio_manager'), 'bk-1')).rejects.toBeInstanceOf(ConflictException);
    expect(razorpay.payments.refund).not.toHaveBeenCalled();
  });

  it('marks the refund failed and writes a refund.failed audit entry when the Razorpay API call fails', async () => {
    const failingRefund = jest.fn().mockRejectedValue(new Error('network error'));
    const { service, refundDocRef, auditLogService } = buildHarness({
      booking: cancelledBookingWithRefund,
      existingPayment: capturedPayment,
      refundImpl: failingRefund,
    });

    await expect(service.processRefund(actor('studio_manager'), 'bk-1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(refundDocRef.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'refund.failed' }));
  });

  it('writes a refund.process audit entry sourced from the authenticated actor on success', async () => {
    const { service, batch, auditLogService } = buildHarness({
      booking: cancelledBookingWithRefund,
      existingPayment: capturedPayment,
    });
    await service.processRefund(actor('studio_manager'), 'bk-1');

    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        actorId: 'manager-1',
        actorRole: 'studio_manager',
        action: 'refund.process',
        entityId: 'bk-1',
      }),
    );
  });
});
