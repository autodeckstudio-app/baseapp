import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import type { CustomersService } from '../customers/customers.service';
import type { VehiclesService } from '../vehicles/vehicles.service';
import type { ServicesService } from '../services/services.service';
import { BookingsService } from './bookings.service';
import { CreateBookingSchema, type CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingSchema, type CancelBookingDto } from './dto/cancel-booking.dto';

type FakeServiceRecord = { serviceId: string; name: string; basePrice: number };
type FakeVehicleRecord = { vehicleId: string; ownerCustomerId: string };
type FakeBookingRecord = {
  status: string;
  priceSnapshot: { advanceAmount: number };
  scheduledAt: { toDate: () => Date };
};

function buildHarness(
  options: {
    existingBookings?: Record<string, FakeBookingRecord>;
    customerExists?: boolean;
    vehicle?: FakeVehicleRecord | null;
    services?: Record<string, FakeServiceRecord | null>;
  } = {},
) {
  const existingBookings = options.existingBookings ?? {};
  const customerExists = options.customerExists ?? true;
  const vehicle = options.vehicle === undefined ? { vehicleId: 'veh-1', ownerCustomerId: 'cust-1' } : options.vehicle;
  const services = options.services ?? { 'svc-1': { serviceId: 'svc-1', name: 'Basic Wash', basePrice: 50000 } };

  const batch = {
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => {
      const docId = id ?? 'generated-booking-id';
      return {
        id: docId,
        get: jest.fn().mockResolvedValue({
          exists: name === 'bookings' && docId in existingBookings,
          data: () => existingBookings[docId],
        }),
      };
    }),
  }));

  const firestoreMock = { collection: collectionMock, batch: jest.fn(() => batch) };
  const app = { firestore: () => firestoreMock } as unknown as admin.app.App;
  const auditLogService = { recordInBatch: jest.fn(), record: jest.fn() } as unknown as AuditLogService;
  const customersService = {
    getCustomerRecord: jest.fn().mockResolvedValue(customerExists ? { customerId: 'cust-1' } : null),
  } as unknown as CustomersService;
  const vehiclesService = {
    getVehicleRecord: jest.fn().mockResolvedValue(vehicle),
  } as unknown as VehiclesService;
  const servicesService = {
    getServiceRecord: jest.fn().mockImplementation(async (serviceId: string) => services[serviceId] ?? null),
  } as unknown as ServicesService;

  const service = new BookingsService(app, auditLogService, customersService, vehiclesService, servicesService);
  return { service, batch, auditLogService, customersService, vehiclesService, servicesService };
}

function actor(role: AuthenticatedUser['role'] = 'staff'): AuthenticatedUser {
  return { uid: 'staff-1', role };
}

const createInput: CreateBookingDto = {
  vehicleId: 'veh-1',
  serviceIds: ['svc-1'],
  scheduledAt: new Date('2026-12-01T10:00:00Z'),
};

describe('CreateBookingSchema', () => {
  it('accepts a valid payload', () => {
    expect(CreateBookingSchema.safeParse(createInput).success).toBe(true);
  });

  it('rejects invalid request data (empty serviceIds)', () => {
    expect(CreateBookingSchema.safeParse({ ...createInput, serviceIds: [] }).success).toBe(false);
  });

  it('rejects invalid request data (missing vehicleId)', () => {
    const { vehicleId: _vehicleId, ...rest } = createInput;
    expect(CreateBookingSchema.safeParse(rest).success).toBe(false);
  });

  it('has no bookingId, customerId, basePrice, price, priceSnapshot, or status field for a client to set', () => {
    const parsed = CreateBookingSchema.parse({
      ...createInput,
      bookingId: 'client-supplied-id',
      customerId: 'attacker-controlled-customer',
      basePrice: 1,
      price: 1,
      priceSnapshot: { total: 1 },
      status: 'sealed',
    });
    expect(parsed).not.toHaveProperty('bookingId');
    expect(parsed).not.toHaveProperty('customerId');
    expect(parsed).not.toHaveProperty('basePrice');
    expect(parsed).not.toHaveProperty('price');
    expect(parsed).not.toHaveProperty('priceSnapshot');
    expect(parsed).not.toHaveProperty('status');
  });
});

describe('CancelBookingSchema', () => {
  it('accepts a valid payload', () => {
    const input: CancelBookingDto = { initiatedBy: 'customer' };
    expect(CancelBookingSchema.safeParse(input).success).toBe(true);
  });

  it('rejects an arbitrary initiatedBy value', () => {
    expect(CancelBookingSchema.safeParse({ initiatedBy: 'someone-else' }).success).toBe(false);
  });

  it('has no refundAmount field for a client to set', () => {
    const parsed = CancelBookingSchema.parse({ initiatedBy: 'customer', refundAmount: 999999 });
    expect(parsed).not.toHaveProperty('refundAmount');
  });
});

describe('BookingsService.createBooking', () => {
  it('creates a booking with a server-generated ID, booked status, and a backend-computed price snapshot', async () => {
    const { service } = buildHarness();
    const result = await service.createBooking(actor(), 'cust-1', createInput);

    expect(result.bookingId).toBe('generated-booking-id');
    expect(result.customerId).toBe('cust-1');
    expect(result.status).toBe('booked');
    expect(result.priceSnapshot.total).toBe(50000);
    expect(result.priceSnapshot.lineItems).toEqual([{ serviceId: 'svc-1', price: 50000 }]);
  });

  it('reads the price exclusively from the authoritative Service record, never from the request', async () => {
    const { service, servicesService } = buildHarness({
      services: { 'svc-1': { serviceId: 'svc-1', name: 'Basic Wash', basePrice: 77777 } },
    });
    const result = await service.createBooking(actor(), 'cust-1', createInput);

    expect(servicesService.getServiceRecord).toHaveBeenCalledWith('svc-1');
    expect(result.priceSnapshot.total).toBe(77777);
  });

  it('ignores a client-injected basePrice/price/priceSnapshot even if smuggled onto the input object', async () => {
    const { service } = buildHarness();
    const tampered = {
      ...createInput,
      basePrice: 1,
      price: 1,
      priceSnapshot: { total: 1, subtotal: 1, lineItems: [], advanceRequired: false, advanceAmount: 0 },
    } as unknown as CreateBookingDto;

    const result = await service.createBooking(actor(), 'cust-1', tampered);
    expect(result.priceSnapshot.total).toBe(50000);
  });

  it('throws NotFoundException when the customer does not exist, and writes nothing', async () => {
    const { service, batch, auditLogService } = buildHarness({ customerExists: false });
    await expect(service.createBooking(actor(), 'ghost-customer', createInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the vehicle does not exist, and writes nothing', async () => {
    const { service, batch, auditLogService } = buildHarness({ vehicle: null });
    await expect(service.createBooking(actor(), 'cust-1', createInput)).rejects.toBeInstanceOf(NotFoundException);
    expect(batch.set).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when a referenced service does not exist, and writes nothing', async () => {
    const { service, batch, auditLogService } = buildHarness({ services: { 'svc-1': null } });
    await expect(service.createBooking(actor(), 'cust-1', createInput)).rejects.toBeInstanceOf(NotFoundException);
    expect(batch.set).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('rejects a vehicle that belongs to a different customer, and writes nothing', async () => {
    const { service, batch, auditLogService } = buildHarness({
      vehicle: { vehicleId: 'veh-1', ownerCustomerId: 'some-other-customer' },
    });
    await expect(service.createBooking(actor(), 'cust-1', createInput)).rejects.toBeInstanceOf(BadRequestException);
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('writes an audit entry sourced from the authenticated actor, not client input', async () => {
    const { service, batch, auditLogService } = buildHarness();
    await service.createBooking(actor(), 'cust-1', createInput);

    expect(batch.set).toHaveBeenCalled();
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'booking.create',
        entityId: 'generated-booking-id',
      }),
    );
    expect(batch.commit).toHaveBeenCalled();
  });
});

describe('BookingsService.cancelBooking', () => {
  const cancelInput: CancelBookingDto = { initiatedBy: 'customer' };

  it('throws NotFoundException for a nonexistent booking', async () => {
    const { service } = buildHarness();
    await expect(service.cancelBooking(actor(), 'ghost', cancelInput)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects cancelling a booking whose status has no transition to cancelled (e.g. already sealed)', async () => {
    const { service, batch, auditLogService } = buildHarness({
      existingBookings: {
        'bk-1': {
          status: 'sealed',
          priceSnapshot: { advanceAmount: 600000 },
          scheduledAt: { toDate: () => new Date(Date.now() + 48 * 60 * 60 * 1000) },
        },
      },
    });

    await expect(service.cancelBooking(actor(), 'bk-1', cancelInput)).rejects.toBeInstanceOf(ConflictException);
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('uses the existing domain state machine, not a reimplementation: booked -> cancelled is allowed', async () => {
    const { service, batch } = buildHarness({
      existingBookings: {
        'bk-1': {
          status: 'booked',
          priceSnapshot: { advanceAmount: 600000 },
          scheduledAt: { toDate: () => new Date(Date.now() + 48 * 60 * 60 * 1000) },
        },
      },
    });

    await service.cancelBooking(actor(), 'bk-1', cancelInput);
    expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'cancelled' }));
  });

  it('grants a full refund via calculateCancellationRefund when cancelled more than 24h before the appointment', async () => {
    const { service, batch } = buildHarness({
      existingBookings: {
        'bk-1': {
          status: 'booked',
          priceSnapshot: { advanceAmount: 600000 },
          scheduledAt: { toDate: () => new Date(Date.now() + 48 * 60 * 60 * 1000) },
        },
      },
    });

    await service.cancelBooking(actor(), 'bk-1', cancelInput);
    expect(batch.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ refundAmount: 600000, refundReason: 'policy_24h' }),
    );
  });

  it('grants no refund via calculateCancellationRefund when cancelled within 24h of the appointment', async () => {
    const { service, batch } = buildHarness({
      existingBookings: {
        'bk-1': {
          status: 'booked',
          priceSnapshot: { advanceAmount: 600000 },
          scheduledAt: { toDate: () => new Date(Date.now() + 1 * 60 * 60 * 1000) },
        },
      },
    });

    await service.cancelBooking(actor(), 'bk-1', cancelInput);
    expect(batch.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ refundAmount: 0, refundReason: 'no_refund_window' }),
    );
  });

  it('grants a full refund regardless of timing when the studio initiates the cancellation', async () => {
    const { service, batch } = buildHarness({
      existingBookings: {
        'bk-1': {
          status: 'booked',
          priceSnapshot: { advanceAmount: 600000 },
          scheduledAt: { toDate: () => new Date(Date.now() + 1 * 60 * 60 * 1000) },
        },
      },
    });

    await service.cancelBooking(actor(), 'bk-1', { initiatedBy: 'studio' });
    expect(batch.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ refundAmount: 600000, refundReason: 'studio_cancelled' }),
    );
  });

  it('ignores a client-injected refundAmount even if smuggled onto the input object', async () => {
    const { service, batch } = buildHarness({
      existingBookings: {
        'bk-1': {
          status: 'booked',
          priceSnapshot: { advanceAmount: 600000 },
          scheduledAt: { toDate: () => new Date(Date.now() + 1 * 60 * 60 * 1000) },
        },
      },
    });

    const tampered = { initiatedBy: 'customer', refundAmount: 999999999 } as unknown as CancelBookingDto;
    await service.cancelBooking(actor(), 'bk-1', tampered);

    // Within the 24h window as a customer-initiated cancellation: the real
    // policy computes 0, never the smuggled value.
    expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ refundAmount: 0 }));
  });

  it('writes an audit entry sourced from the authenticated actor and the computed refund decision', async () => {
    const { service, batch, auditLogService } = buildHarness({
      existingBookings: {
        'bk-1': {
          status: 'booked',
          priceSnapshot: { advanceAmount: 600000 },
          scheduledAt: { toDate: () => new Date(Date.now() + 48 * 60 * 60 * 1000) },
        },
      },
    });

    await service.cancelBooking(actor(), 'bk-1', cancelInput);
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'booking.cancel',
        entityId: 'bk-1',
        before: { status: 'booked' },
        after: expect.objectContaining({ status: 'cancelled', refundAmount: 600000 }),
      }),
    );
    expect(batch.commit).toHaveBeenCalled();
  });

  it('does not write an audit entry (or any Firestore write) when the target does not exist', async () => {
    const { service, auditLogService, batch } = buildHarness();
    await expect(service.cancelBooking(actor(), 'ghost', cancelInput)).rejects.toThrow();

    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });
});
